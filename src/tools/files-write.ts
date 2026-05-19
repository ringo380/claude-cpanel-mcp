import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import type { CpanelClient } from '../cpanel-client.js';
import { unconfiguredResult, asJsonContent, asErrorContent } from './generic.js';

type GetClient = () => CpanelClient | null;

/**
 * System paths that almost certainly aren't writable by a cPanel user and
 * where a write would suggest a path-handling bug upstream. We block these
 * outright with a clear error rather than letting the server return a cryptic
 * permission-denied.
 *
 * Note: cPanel home dirs are typically /home/<user>, so user files always live
 * outside this list.
 */
// Block writes under these roots AND their descendants (prefix match, not
// exact-match). cPanel users normally work under /home/<user>, so this list
// catches "obvious mistake" paths a long way before relying on cPanel's
// server-side perm checks.
const DANGEROUS_PREFIXES = [
  '/etc',
  '/var',
  '/usr',
  '/bin',
  '/sbin',
  '/boot',
  '/sys',
  '/proc',
  '/dev',
  '/lib',
  '/lib64',
  '/opt',
  '/root',
];

export function pathLooksDangerous(dir: string): boolean {
  const normalized = dir.replace(/\/+$/, '') || '/';
  if (normalized === '/') return true;
  for (const root of DANGEROUS_PREFIXES) {
    if (normalized === root || normalized.startsWith(`${root}/`)) return true;
  }
  return false;
}

function dangerousPathError(dir: string) {
  return {
    isError: true,
    content: [
      {
        type: 'text' as const,
        text:
          `Refusing to operate on "${dir}" — this looks like a system path. ` +
          `cPanel users normally work under /home/<user>. If you really need this, ` +
          `call uapi_call directly with Fileman::<op> at your own risk.`,
      },
    ],
  };
}

// Reject filename arguments that would let a caller escape `dir` via
// traversal, embed null bytes (filesystem boundary truncation), or supply an
// absolute path masquerading as a filename.
export function validateFilename(file: string): string | null {
  if (file.length === 0) return 'filename is empty';
  if (file.includes('\0')) return 'filename contains a null byte';
  if (file.includes('/') || file.includes('\\')) {
    return 'filename must not contain "/" or "\\\\" — pass the directory in `dir` instead';
  }
  if (file === '.' || file === '..') return 'filename "." / ".." is not allowed';
  return null;
}

function filenameError(reason: string) {
  return {
    isError: true,
    content: [{ type: 'text' as const, text: `Refusing operation: ${reason}.` }],
  };
}

export function registerFileWriteTools(server: McpServer, getClient: GetClient): void {
  server.registerTool(
    'files_write_file',
    {
      description:
        'Write text content to a file. Wraps Fileman::save_file_content (POST). ' +
        'Overwrites if the file exists, creates it otherwise. For binary data, base64-encode ' +
        'into a text representation first or use files_upload (not yet implemented).',
      inputSchema: {
        dir: z.string().describe('Absolute directory path, e.g. "/home/woobyava/public_html".'),
        file: z.string().describe('Filename (no slashes).'),
        content: z.string().describe('UTF-8 text content to write.'),
        from_charset: z.string().optional().describe('Source charset, default "utf-8".'),
        to_charset: z.string().optional().describe('Target charset, default "utf-8".'),
      },
    },
    async ({ dir, file, content, from_charset, to_charset }) => {
      const client = getClient();
      if (!client) return unconfiguredResult();
      if (pathLooksDangerous(dir)) return dangerousPathError(dir);
      const nameErr = validateFilename(file);
      if (nameErr) return filenameError(nameErr);
      try {
        const res = await client.call('Fileman', 'save_file_content', {
          dir,
          file,
          content,
          from_charset: from_charset ?? 'utf-8',
          to_charset: to_charset ?? 'utf-8',
        });
        return asJsonContent({ wrote: `${dir}/${file}`, bytes: content.length, uapi: res });
      } catch (err) {
        return asErrorContent(err);
      }
    },
  );

  server.registerTool(
    'files_create_directory',
    {
      description: 'Create a directory. Wraps Fileman::mkdir.',
      inputSchema: {
        path: z.string().describe('Parent directory path.'),
        name: z.string().describe('Name of the directory to create inside `path`.'),
        permissions: z.string().optional().describe('Octal permissions, e.g. "0755". Defaults to cPanel\'s default.'),
      },
    },
    async ({ path, name, permissions }) => {
      const client = getClient();
      if (!client) return unconfiguredResult();
      if (pathLooksDangerous(path)) return dangerousPathError(path);
      const nameErr = validateFilename(name);
      if (nameErr) return filenameError(nameErr);
      try {
        const params: Record<string, string | number> = { path, name };
        if (permissions) params.permissions = permissions;
        return asJsonContent(await client.call('Fileman', 'mkdir', params));
      } catch (err) {
        return asErrorContent(err);
      }
    },
  );

  server.registerTool(
    'files_delete',
    {
      description:
        'Delete one or more files or directories. Wraps Fileman::delete_files. ' +
        'DESTRUCTIVE — no undo, no trash. Targets must live under a non-system path.',
      inputSchema: {
        dir: z.string().describe('Parent directory.'),
        files: z
          .union([z.string(), z.array(z.string())])
          .describe('Filename or array of filenames within `dir`.'),
        confirm: z.boolean().describe('Must be true. Guards against accidental deletion.'),
      },
    },
    async ({ dir, files, confirm }) => {
      const client = getClient();
      if (!client) return unconfiguredResult();
      if (!confirm) {
        return {
          isError: true,
          content: [
            {
              type: 'text' as const,
              text: 'Refusing to delete: pass `confirm: true` to acknowledge this is irreversible.',
            },
          ],
        };
      }
      if (pathLooksDangerous(dir)) return dangerousPathError(dir);
      const fileArr = Array.isArray(files) ? files : [files];
      for (const f of fileArr) {
        const nameErr = validateFilename(f);
        if (nameErr) return filenameError(`${nameErr} ("${f}")`);
      }
      try {
        return asJsonContent(
          await client.call('Fileman', 'delete_files', { dir, files: fileArr.join(',') }),
        );
      } catch (err) {
        return asErrorContent(err);
      }
    },
  );

  server.registerTool(
    'files_move',
    {
      description: 'Move/rename files. Wraps Fileman::move_files.',
      inputSchema: {
        source_dir: z.string(),
        dest_dir: z.string(),
        files: z.union([z.string(), z.array(z.string())]).describe('Filename(s) within source_dir.'),
      },
    },
    async ({ source_dir, dest_dir, files }) => {
      const client = getClient();
      if (!client) return unconfiguredResult();
      if (pathLooksDangerous(source_dir) || pathLooksDangerous(dest_dir)) {
        return dangerousPathError(pathLooksDangerous(source_dir) ? source_dir : dest_dir);
      }
      const fileArr = Array.isArray(files) ? files : [files];
      for (const f of fileArr) {
        const nameErr = validateFilename(f);
        if (nameErr) return filenameError(`${nameErr} ("${f}")`);
      }
      try {
        return asJsonContent(
          await client.call('Fileman', 'move_files', {
            source_dir,
            dest_dir,
            files: fileArr.join(','),
          }),
        );
      } catch (err) {
        return asErrorContent(err);
      }
    },
  );

  server.registerTool(
    'files_copy',
    {
      description: 'Copy files. Wraps Fileman::copy_files.',
      inputSchema: {
        source_dir: z.string(),
        dest_dir: z.string(),
        files: z.union([z.string(), z.array(z.string())]),
      },
    },
    async ({ source_dir, dest_dir, files }) => {
      const client = getClient();
      if (!client) return unconfiguredResult();
      if (pathLooksDangerous(source_dir) || pathLooksDangerous(dest_dir)) {
        return dangerousPathError(pathLooksDangerous(source_dir) ? source_dir : dest_dir);
      }
      const fileArr = Array.isArray(files) ? files : [files];
      for (const f of fileArr) {
        const nameErr = validateFilename(f);
        if (nameErr) return filenameError(`${nameErr} ("${f}")`);
      }
      try {
        return asJsonContent(
          await client.call('Fileman', 'copy_files', {
            source_dir,
            dest_dir,
            files: fileArr.join(','),
          }),
        );
      } catch (err) {
        return asErrorContent(err);
      }
    },
  );

  server.registerTool(
    'files_chmod',
    {
      description: 'Change permissions on files. Wraps Fileman::chmod.',
      inputSchema: {
        dir: z.string(),
        files: z.union([z.string(), z.array(z.string())]),
        permissions: z.string().describe('Octal string, e.g. "0755" or "0644".'),
      },
    },
    async ({ dir, files, permissions }) => {
      const client = getClient();
      if (!client) return unconfiguredResult();
      if (pathLooksDangerous(dir)) return dangerousPathError(dir);
      const fileArr = Array.isArray(files) ? files : [files];
      for (const f of fileArr) {
        const nameErr = validateFilename(f);
        if (nameErr) return filenameError(`${nameErr} ("${f}")`);
      }
      try {
        return asJsonContent(
          await client.call('Fileman', 'chmod', { dir, files: fileArr.join(','), permissions }),
        );
      } catch (err) {
        return asErrorContent(err);
      }
    },
  );

  server.registerTool(
    'files_compress',
    {
      description:
        'Compress files into an archive. Wraps Fileman::compress_files. Supported types: zip, tar, tar.gz (gz), tar.bz2 (bz2).',
      inputSchema: {
        sources: z.array(z.string()).describe('Absolute paths to files/directories to include.'),
        destination: z.string().describe('Absolute path to the archive to create.'),
        type: z.enum(['zip', 'tar', 'gz', 'bz2']).describe('Archive type.'),
      },
    },
    async ({ sources, destination, type }) => {
      const client = getClient();
      if (!client) return unconfiguredResult();
      try {
        return asJsonContent(
          await client.call('Fileman', 'compress_files', {
            sources: sources.join(','),
            destination,
            type,
          }),
        );
      } catch (err) {
        return asErrorContent(err);
      }
    },
  );

  server.registerTool(
    'files_extract',
    {
      description: 'Extract an archive. Wraps Fileman::extract.',
      inputSchema: {
        sources: z.array(z.string()).describe('Archive file(s) to extract.'),
        destination: z.string().describe('Target directory.'),
      },
    },
    async ({ sources, destination }) => {
      const client = getClient();
      if (!client) return unconfiguredResult();
      if (pathLooksDangerous(destination)) return dangerousPathError(destination);
      try {
        return asJsonContent(
          await client.call('Fileman', 'extract', {
            sources: sources.join(','),
            destination,
          }),
        );
      } catch (err) {
        return asErrorContent(err);
      }
    },
  );
}
