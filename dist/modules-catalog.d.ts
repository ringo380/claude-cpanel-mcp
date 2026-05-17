/**
 * Static catalog of common UAPI modules and a sampling of their most-used
 * functions. NOT exhaustive — UAPI exposes 80+ modules. This list is a
 * navigation aid for `list_modules` and `list_functions`; users can always
 * call `uapi_call(module, function, params)` directly even for items not
 * listed here.
 *
 * Reference: https://api.docs.cpanel.net/openapi/cpanel-public/operations/
 */
export interface ModuleInfo {
    name: string;
    description: string;
    functions: {
        name: string;
        description: string;
    }[];
}
export declare const MODULES: ModuleInfo[];
export declare const MODULE_MAP: Map<string, ModuleInfo>;
