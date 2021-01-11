import * as fs from 'fs';
import {
    Position,
    Range,
    SymbolKind,
    DocumentSymbol
} from 'vscode-languageserver';

import {
    TextDocument
} from 'vscode-languageserver-textdocument';
import { builtin_variable } from './constants';
import { pathanalyze } from './server';

export interface AhkDoc {
    statement: StateMent
    include: string[]
    children: DocumentSymbol[]
    funccall: DocumentSymbol[]
}

export enum FuncScope {
    DEFAULT = 0, LOCAL = 1, STATIC = 2, GLOBAL = 4
}

export interface StateMent {
    assume: FuncScope
    global?: { [key: string]: Variable | DocumentSymbol }
    local?: { [key: string]: Variable }
    define?: { [key: string]: Variable }
}

export interface FuncNode extends DocumentSymbol {
    params: Variable[]
    full: string
    statement: StateMent
    variables?: DocumentSymbol[]
    parent?: DocumentSymbol
}

export interface ClassNode extends DocumentSymbol {
    extends: string
    parent?: DocumentSymbol
}

export interface Word {
    name: string
    range: Range
}

export interface Variable extends DocumentSymbol {
    byref?: boolean
    defaultVal?: string
}

export interface ReferenceInfomation {
    name: string
    line: number
}

export namespace SymbolNode {
    export function create(name: string, kind: SymbolKind, range: Range, selectionRange: Range, children?: DocumentSymbol[]): DocumentSymbol {
        return { name, kind, range, selectionRange, children };
    }
}

export namespace FuncNode {
    export function create(name: string, kind: SymbolKind, range: Range, selectionRange: Range, params: Variable[], children?: DocumentSymbol[]): FuncNode {
        let full = '', statement = { assume: FuncScope.DEFAULT };
        params.map(param => {
            full += ', ' + (param.byref ? 'ByRef ' : '') + param.name + (param.defaultVal ? ' := ' + param.defaultVal : '');
        });
        full = name + '(' + full.substring(2) + ')';
        return { name, kind, range, selectionRange, params, full, children, statement };
    }
}

export namespace Word {
    export function create(name: string, range: Range): Word {
        return { name, range };
    }
}

namespace Variable {
    export function create(name: string, kind: SymbolKind, range: Range, selectionRange: Range): Variable {
        return { name, kind, range, selectionRange };
    }
}

export namespace ReferenceInfomation {
    export function create(name: string, line: number): ReferenceInfomation {
        return { name, line };
    }
}

export namespace acorn {
    export function isIdentifierChar(code: number) {
        let nonASCIIidentifier = new RegExp("[\xaa\xb5\xba\xc0-\xd6\xd8-\xf6\xf8-\u02c1\u02c6-\u02d1\u02e0-\u02e4\u02ec\u02ee\u0370-\u0374\u0376\u0377\u037a-\u037d\u0386\u0388-\u038a\u038c\u038e-\u03a1\u03a3-\u03f5\u03f7-\u0481\u048a-\u0527\u0531-\u0556\u0559\u0561-\u0587\u05d0-\u05ea\u05f0-\u05f2\u0620-\u064a\u066e\u066f\u0671-\u06d3\u06d5\u06e5\u06e6\u06ee\u06ef\u06fa-\u06fc\u06ff\u0710\u0712-\u072f\u074d-\u07a5\u07b1\u07ca-\u07ea\u07f4\u07f5\u07fa\u0800-\u0815\u081a\u0824\u0828\u0840-\u0858\u08a0\u08a2-\u08ac\u0904-\u0939\u093d\u0950\u0958-\u0961\u0971-\u0977\u0979-\u097f\u0985-\u098c\u098f\u0990\u0993-\u09a8\u09aa-\u09b0\u09b2\u09b6-\u09b9\u09bd\u09ce\u09dc\u09dd\u09df-\u09e1\u09f0\u09f1\u0a05-\u0a0a\u0a0f\u0a10\u0a13-\u0a28\u0a2a-\u0a30\u0a32\u0a33\u0a35\u0a36\u0a38\u0a39\u0a59-\u0a5c\u0a5e\u0a72-\u0a74\u0a85-\u0a8d\u0a8f-\u0a91\u0a93-\u0aa8\u0aaa-\u0ab0\u0ab2\u0ab3\u0ab5-\u0ab9\u0abd\u0ad0\u0ae0\u0ae1\u0b05-\u0b0c\u0b0f\u0b10\u0b13-\u0b28\u0b2a-\u0b30\u0b32\u0b33\u0b35-\u0b39\u0b3d\u0b5c\u0b5d\u0b5f-\u0b61\u0b71\u0b83\u0b85-\u0b8a\u0b8e-\u0b90\u0b92-\u0b95\u0b99\u0b9a\u0b9c\u0b9e\u0b9f\u0ba3\u0ba4\u0ba8-\u0baa\u0bae-\u0bb9\u0bd0\u0c05-\u0c0c\u0c0e-\u0c10\u0c12-\u0c28\u0c2a-\u0c33\u0c35-\u0c39\u0c3d\u0c58\u0c59\u0c60\u0c61\u0c85-\u0c8c\u0c8e-\u0c90\u0c92-\u0ca8\u0caa-\u0cb3\u0cb5-\u0cb9\u0cbd\u0cde\u0ce0\u0ce1\u0cf1\u0cf2\u0d05-\u0d0c\u0d0e-\u0d10\u0d12-\u0d3a\u0d3d\u0d4e\u0d60\u0d61\u0d7a-\u0d7f\u0d85-\u0d96\u0d9a-\u0db1\u0db3-\u0dbb\u0dbd\u0dc0-\u0dc6\u0e01-\u0e30\u0e32\u0e33\u0e40-\u0e46\u0e81\u0e82\u0e84\u0e87\u0e88\u0e8a\u0e8d\u0e94-\u0e97\u0e99-\u0e9f\u0ea1-\u0ea3\u0ea5\u0ea7\u0eaa\u0eab\u0ead-\u0eb0\u0eb2\u0eb3\u0ebd\u0ec0-\u0ec4\u0ec6\u0edc-\u0edf\u0f00\u0f40-\u0f47\u0f49-\u0f6c\u0f88-\u0f8c\u1000-\u102a\u103f\u1050-\u1055\u105a-\u105d\u1061\u1065\u1066\u106e-\u1070\u1075-\u1081\u108e\u10a0-\u10c5\u10c7\u10cd\u10d0-\u10fa\u10fc-\u1248\u124a-\u124d\u1250-\u1256\u1258\u125a-\u125d\u1260-\u1288\u128a-\u128d\u1290-\u12b0\u12b2-\u12b5\u12b8-\u12be\u12c0\u12c2-\u12c5\u12c8-\u12d6\u12d8-\u1310\u1312-\u1315\u1318-\u135a\u1380-\u138f\u13a0-\u13f4\u1401-\u166c\u166f-\u167f\u1681-\u169a\u16a0-\u16ea\u16ee-\u16f0\u1700-\u170c\u170e-\u1711\u1720-\u1731\u1740-\u1751\u1760-\u176c\u176e-\u1770\u1780-\u17b3\u17d7\u17dc\u1820-\u1877\u1880-\u18a8\u18aa\u18b0-\u18f5\u1900-\u191c\u1950-\u196d\u1970-\u1974\u1980-\u19ab\u19c1-\u19c7\u1a00-\u1a16\u1a20-\u1a54\u1aa7\u1b05-\u1b33\u1b45-\u1b4b\u1b83-\u1ba0\u1bae\u1baf\u1bba-\u1be5\u1c00-\u1c23\u1c4d-\u1c4f\u1c5a-\u1c7d\u1ce9-\u1cec\u1cee-\u1cf1\u1cf5\u1cf6\u1d00-\u1dbf\u1e00-\u1f15\u1f18-\u1f1d\u1f20-\u1f45\u1f48-\u1f4d\u1f50-\u1f57\u1f59\u1f5b\u1f5d\u1f5f-\u1f7d\u1f80-\u1fb4\u1fb6-\u1fbc\u1fbe\u1fc2-\u1fc4\u1fc6-\u1fcc\u1fd0-\u1fd3\u1fd6-\u1fdb\u1fe0-\u1fec\u1ff2-\u1ff4\u1ff6-\u1ffc\u2071\u207f\u2090-\u209c\u2102\u2107\u210a-\u2113\u2115\u2119-\u211d\u2124\u2126\u2128\u212a-\u212d\u212f-\u2139\u213c-\u213f\u2145-\u2149\u214e\u2160-\u2188\u2c00-\u2c2e\u2c30-\u2c5e\u2c60-\u2ce4\u2ceb-\u2cee\u2cf2\u2cf3\u2d00-\u2d25\u2d27\u2d2d\u2d30-\u2d67\u2d6f\u2d80-\u2d96\u2da0-\u2da6\u2da8-\u2dae\u2db0-\u2db6\u2db8-\u2dbe\u2dc0-\u2dc6\u2dc8-\u2dce\u2dd0-\u2dd6\u2dd8-\u2dde\u2e2f\u3005-\u3007\u3021-\u3029\u3031-\u3035\u3038-\u303c\u3041-\u3096\u309d-\u309f\u30a1-\u30fa\u30fc-\u30ff\u3105-\u312d\u3131-\u318e\u31a0-\u31ba\u31f0-\u31ff\u3400-\u4db5\u4e00-\u9fcc\ua000-\ua48c\ua4d0-\ua4fd\ua500-\ua60c\ua610-\ua61f\ua62a\ua62b\ua640-\ua66e\ua67f-\ua697\ua6a0-\ua6ef\ua717-\ua71f\ua722-\ua788\ua78b-\ua78e\ua790-\ua793\ua7a0-\ua7aa\ua7f8-\ua801\ua803-\ua805\ua807-\ua80a\ua80c-\ua822\ua840-\ua873\ua882-\ua8b3\ua8f2-\ua8f7\ua8fb\ua90a-\ua925\ua930-\ua946\ua960-\ua97c\ua984-\ua9b2\ua9cf\uaa00-\uaa28\uaa40-\uaa42\uaa44-\uaa4b\uaa60-\uaa76\uaa7a\uaa80-\uaaaf\uaab1\uaab5\uaab6\uaab9-\uaabd\uaac0\uaac2\uaadb-\uaadd\uaae0-\uaaea\uaaf2-\uaaf4\uab01-\uab06\uab09-\uab0e\uab11-\uab16\uab20-\uab26\uab28-\uab2e\uabc0-\uabe2\uac00-\ud7a3\ud7b0-\ud7c6\ud7cb-\ud7fb\uf900-\ufa6d\ufa70-\ufad9\ufb00-\ufb06\ufb13-\ufb17\ufb1d\ufb1f-\ufb28\ufb2a-\ufb36\ufb38-\ufb3c\ufb3e\ufb40\ufb41\ufb43\ufb44\ufb46-\ufbb1\ufbd3-\ufd3d\ufd50-\ufd8f\ufd92-\ufdc7\ufdf0-\ufdfb\ufe70-\ufe74\ufe76-\ufefc\uff21-\uff3a\uff41-\uff5a\uff66-\uffbe\uffc2-\uffc7\uffca-\uffcf\uffd2-\uffd7\uffda-\uffdc\u0300-\u036f\u0483-\u0487\u0591-\u05bd\u05bf\u05c1\u05c2\u05c4\u05c5\u05c7\u0610-\u061a\u0620-\u0649\u0672-\u06d3\u06e7-\u06e8\u06fb-\u06fc\u0730-\u074a\u0800-\u0814\u081b-\u0823\u0825-\u0827\u0829-\u082d\u0840-\u0857\u08e4-\u08fe\u0900-\u0903\u093a-\u093c\u093e-\u094f\u0951-\u0957\u0962-\u0963\u0966-\u096f\u0981-\u0983\u09bc\u09be-\u09c4\u09c7\u09c8\u09d7\u09df-\u09e0\u0a01-\u0a03\u0a3c\u0a3e-\u0a42\u0a47\u0a48\u0a4b-\u0a4d\u0a51\u0a66-\u0a71\u0a75\u0a81-\u0a83\u0abc\u0abe-\u0ac5\u0ac7-\u0ac9\u0acb-\u0acd\u0ae2-\u0ae3\u0ae6-\u0aef\u0b01-\u0b03\u0b3c\u0b3e-\u0b44\u0b47\u0b48\u0b4b-\u0b4d\u0b56\u0b57\u0b5f-\u0b60\u0b66-\u0b6f\u0b82\u0bbe-\u0bc2\u0bc6-\u0bc8\u0bca-\u0bcd\u0bd7\u0be6-\u0bef\u0c01-\u0c03\u0c46-\u0c48\u0c4a-\u0c4d\u0c55\u0c56\u0c62-\u0c63\u0c66-\u0c6f\u0c82\u0c83\u0cbc\u0cbe-\u0cc4\u0cc6-\u0cc8\u0cca-\u0ccd\u0cd5\u0cd6\u0ce2-\u0ce3\u0ce6-\u0cef\u0d02\u0d03\u0d46-\u0d48\u0d57\u0d62-\u0d63\u0d66-\u0d6f\u0d82\u0d83\u0dca\u0dcf-\u0dd4\u0dd6\u0dd8-\u0ddf\u0df2\u0df3\u0e34-\u0e3a\u0e40-\u0e45\u0e50-\u0e59\u0eb4-\u0eb9\u0ec8-\u0ecd\u0ed0-\u0ed9\u0f18\u0f19\u0f20-\u0f29\u0f35\u0f37\u0f39\u0f41-\u0f47\u0f71-\u0f84\u0f86-\u0f87\u0f8d-\u0f97\u0f99-\u0fbc\u0fc6\u1000-\u1029\u1040-\u1049\u1067-\u106d\u1071-\u1074\u1082-\u108d\u108f-\u109d\u135d-\u135f\u170e-\u1710\u1720-\u1730\u1740-\u1750\u1772\u1773\u1780-\u17b2\u17dd\u17e0-\u17e9\u180b-\u180d\u1810-\u1819\u1920-\u192b\u1930-\u193b\u1951-\u196d\u19b0-\u19c0\u19c8-\u19c9\u19d0-\u19d9\u1a00-\u1a15\u1a20-\u1a53\u1a60-\u1a7c\u1a7f-\u1a89\u1a90-\u1a99\u1b46-\u1b4b\u1b50-\u1b59\u1b6b-\u1b73\u1bb0-\u1bb9\u1be6-\u1bf3\u1c00-\u1c22\u1c40-\u1c49\u1c5b-\u1c7d\u1cd0-\u1cd2\u1d00-\u1dbe\u1e01-\u1f15\u200c\u200d\u203f\u2040\u2054\u20d0-\u20dc\u20e1\u20e5-\u20f0\u2d81-\u2d96\u2de0-\u2dff\u3021-\u3028\u3099\u309a\ua640-\ua66d\ua674-\ua67d\ua69f\ua6f0-\ua6f1\ua7f8-\ua800\ua806\ua80b\ua823-\ua827\ua880-\ua881\ua8b4-\ua8c4\ua8d0-\ua8d9\ua8f3-\ua8f7\ua900-\ua909\ua926-\ua92d\ua930-\ua945\ua980-\ua983\ua9b3-\ua9c0\uaa00-\uaa27\uaa40-\uaa41\uaa4c-\uaa4d\uaa50-\uaa59\uaa7b\uaae0-\uaae9\uaaf2-\uaaf3\uabc0-\uabe1\uabec\uabed\uabf0-\uabf9\ufb20-\ufb28\ufe00-\ufe0f\ufe20-\ufe26\ufe33\ufe34\ufe4d-\ufe4f\uff10-\uff19\uff3f]");
        if (code < 48) return code === 36;
        if (code < 58) return true;
        if (code < 65) return false;
        if (code < 91) return true;
        if (code < 97) return code === 95;
        if (code < 123) return true;
        return code >= 0xaa && nonASCIIidentifier.test(String.fromCharCode(code));
    }
    export function isIdentifierStart(code: number) {
        let nonASCIIidentifierStart = new RegExp("[\xaa\xb5\xba\xc0-\xd6\xd8-\xf6\xf8-\u02c1\u02c6-\u02d1\u02e0-\u02e4\u02ec\u02ee\u0370-\u0374\u0376\u0377\u037a-\u037d\u0386\u0388-\u038a\u038c\u038e-\u03a1\u03a3-\u03f5\u03f7-\u0481\u048a-\u0527\u0531-\u0556\u0559\u0561-\u0587\u05d0-\u05ea\u05f0-\u05f2\u0620-\u064a\u066e\u066f\u0671-\u06d3\u06d5\u06e5\u06e6\u06ee\u06ef\u06fa-\u06fc\u06ff\u0710\u0712-\u072f\u074d-\u07a5\u07b1\u07ca-\u07ea\u07f4\u07f5\u07fa\u0800-\u0815\u081a\u0824\u0828\u0840-\u0858\u08a0\u08a2-\u08ac\u0904-\u0939\u093d\u0950\u0958-\u0961\u0971-\u0977\u0979-\u097f\u0985-\u098c\u098f\u0990\u0993-\u09a8\u09aa-\u09b0\u09b2\u09b6-\u09b9\u09bd\u09ce\u09dc\u09dd\u09df-\u09e1\u09f0\u09f1\u0a05-\u0a0a\u0a0f\u0a10\u0a13-\u0a28\u0a2a-\u0a30\u0a32\u0a33\u0a35\u0a36\u0a38\u0a39\u0a59-\u0a5c\u0a5e\u0a72-\u0a74\u0a85-\u0a8d\u0a8f-\u0a91\u0a93-\u0aa8\u0aaa-\u0ab0\u0ab2\u0ab3\u0ab5-\u0ab9\u0abd\u0ad0\u0ae0\u0ae1\u0b05-\u0b0c\u0b0f\u0b10\u0b13-\u0b28\u0b2a-\u0b30\u0b32\u0b33\u0b35-\u0b39\u0b3d\u0b5c\u0b5d\u0b5f-\u0b61\u0b71\u0b83\u0b85-\u0b8a\u0b8e-\u0b90\u0b92-\u0b95\u0b99\u0b9a\u0b9c\u0b9e\u0b9f\u0ba3\u0ba4\u0ba8-\u0baa\u0bae-\u0bb9\u0bd0\u0c05-\u0c0c\u0c0e-\u0c10\u0c12-\u0c28\u0c2a-\u0c33\u0c35-\u0c39\u0c3d\u0c58\u0c59\u0c60\u0c61\u0c85-\u0c8c\u0c8e-\u0c90\u0c92-\u0ca8\u0caa-\u0cb3\u0cb5-\u0cb9\u0cbd\u0cde\u0ce0\u0ce1\u0cf1\u0cf2\u0d05-\u0d0c\u0d0e-\u0d10\u0d12-\u0d3a\u0d3d\u0d4e\u0d60\u0d61\u0d7a-\u0d7f\u0d85-\u0d96\u0d9a-\u0db1\u0db3-\u0dbb\u0dbd\u0dc0-\u0dc6\u0e01-\u0e30\u0e32\u0e33\u0e40-\u0e46\u0e81\u0e82\u0e84\u0e87\u0e88\u0e8a\u0e8d\u0e94-\u0e97\u0e99-\u0e9f\u0ea1-\u0ea3\u0ea5\u0ea7\u0eaa\u0eab\u0ead-\u0eb0\u0eb2\u0eb3\u0ebd\u0ec0-\u0ec4\u0ec6\u0edc-\u0edf\u0f00\u0f40-\u0f47\u0f49-\u0f6c\u0f88-\u0f8c\u1000-\u102a\u103f\u1050-\u1055\u105a-\u105d\u1061\u1065\u1066\u106e-\u1070\u1075-\u1081\u108e\u10a0-\u10c5\u10c7\u10cd\u10d0-\u10fa\u10fc-\u1248\u124a-\u124d\u1250-\u1256\u1258\u125a-\u125d\u1260-\u1288\u128a-\u128d\u1290-\u12b0\u12b2-\u12b5\u12b8-\u12be\u12c0\u12c2-\u12c5\u12c8-\u12d6\u12d8-\u1310\u1312-\u1315\u1318-\u135a\u1380-\u138f\u13a0-\u13f4\u1401-\u166c\u166f-\u167f\u1681-\u169a\u16a0-\u16ea\u16ee-\u16f0\u1700-\u170c\u170e-\u1711\u1720-\u1731\u1740-\u1751\u1760-\u176c\u176e-\u1770\u1780-\u17b3\u17d7\u17dc\u1820-\u1877\u1880-\u18a8\u18aa\u18b0-\u18f5\u1900-\u191c\u1950-\u196d\u1970-\u1974\u1980-\u19ab\u19c1-\u19c7\u1a00-\u1a16\u1a20-\u1a54\u1aa7\u1b05-\u1b33\u1b45-\u1b4b\u1b83-\u1ba0\u1bae\u1baf\u1bba-\u1be5\u1c00-\u1c23\u1c4d-\u1c4f\u1c5a-\u1c7d\u1ce9-\u1cec\u1cee-\u1cf1\u1cf5\u1cf6\u1d00-\u1dbf\u1e00-\u1f15\u1f18-\u1f1d\u1f20-\u1f45\u1f48-\u1f4d\u1f50-\u1f57\u1f59\u1f5b\u1f5d\u1f5f-\u1f7d\u1f80-\u1fb4\u1fb6-\u1fbc\u1fbe\u1fc2-\u1fc4\u1fc6-\u1fcc\u1fd0-\u1fd3\u1fd6-\u1fdb\u1fe0-\u1fec\u1ff2-\u1ff4\u1ff6-\u1ffc\u2071\u207f\u2090-\u209c\u2102\u2107\u210a-\u2113\u2115\u2119-\u211d\u2124\u2126\u2128\u212a-\u212d\u212f-\u2139\u213c-\u213f\u2145-\u2149\u214e\u2160-\u2188\u2c00-\u2c2e\u2c30-\u2c5e\u2c60-\u2ce4\u2ceb-\u2cee\u2cf2\u2cf3\u2d00-\u2d25\u2d27\u2d2d\u2d30-\u2d67\u2d6f\u2d80-\u2d96\u2da0-\u2da6\u2da8-\u2dae\u2db0-\u2db6\u2db8-\u2dbe\u2dc0-\u2dc6\u2dc8-\u2dce\u2dd0-\u2dd6\u2dd8-\u2dde\u2e2f\u3005-\u3007\u3021-\u3029\u3031-\u3035\u3038-\u303c\u3041-\u3096\u309d-\u309f\u30a1-\u30fa\u30fc-\u30ff\u3105-\u312d\u3131-\u318e\u31a0-\u31ba\u31f0-\u31ff\u3400-\u4db5\u4e00-\u9fcc\ua000-\ua48c\ua4d0-\ua4fd\ua500-\ua60c\ua610-\ua61f\ua62a\ua62b\ua640-\ua66e\ua67f-\ua697\ua6a0-\ua6ef\ua717-\ua71f\ua722-\ua788\ua78b-\ua78e\ua790-\ua793\ua7a0-\ua7aa\ua7f8-\ua801\ua803-\ua805\ua807-\ua80a\ua80c-\ua822\ua840-\ua873\ua882-\ua8b3\ua8f2-\ua8f7\ua8fb\ua90a-\ua925\ua930-\ua946\ua960-\ua97c\ua984-\ua9b2\ua9cf\uaa00-\uaa28\uaa40-\uaa42\uaa44-\uaa4b\uaa60-\uaa76\uaa7a\uaa80-\uaaaf\uaab1\uaab5\uaab6\uaab9-\uaabd\uaac0\uaac2\uaadb-\uaadd\uaae0-\uaaea\uaaf2-\uaaf4\uab01-\uab06\uab09-\uab0e\uab11-\uab16\uab20-\uab26\uab28-\uab2e\uabc0-\uabe2\uac00-\ud7a3\ud7b0-\ud7c6\ud7cb-\ud7fb\uf900-\ufa6d\ufa70-\ufad9\ufb00-\ufb06\ufb13-\ufb17\ufb1d\ufb1f-\ufb28\ufb2a-\ufb36\ufb38-\ufb3c\ufb3e\ufb40\ufb41\ufb43\ufb44\ufb46-\ufbb1\ufbd3-\ufd3d\ufd50-\ufd8f\ufd92-\ufdc7\ufdf0-\ufdfb\ufe70-\ufe74\ufe76-\ufefc\uff21-\uff3a\uff41-\uff5a\uff66-\uffbe\uffc2-\uffc7\uffca-\uffcf\uffd2-\uffd7\uffda-\uffdc]");
        if (code < 65) return code === 36;
        if (code < 91) return true;
        if (code < 97) return code === 95;
        if (code < 123) return true;
        return code >= 0xaa && nonASCIIidentifierStart.test(String.fromCharCode(code));
    }
}

export class Lexer {
    public beautify: Function;
    public parseScript: Function;
    public symboltree: DocumentSymbol[] = [];
    public blocks: DocumentSymbol[] | undefined;
    public root: AhkDoc = { statement: { assume: FuncScope.DEFAULT }, include: [], children: [], funccall: [] };
    public cache: DocumentSymbol[] = [];
    public scriptpath: string;
    public texts: { [key: string]: string } = {};
    public includetable: { [uri: string]: { url: string, path: string, raw: string } } = {};
    private reference: ReferenceInfomation[] = [];
    document: TextDocument;
    constructor(document: TextDocument) {
        let input: string, output_lines: { text: any[]; }[], flags: any, opt: any, previous_flags: any, prefix: string, flag_store: any[], includetable: { [uri: string]: { url: string, path: string, raw: string } };
        let token_text: string, token_text_low: string, token_type: string, last_type: string, last_text: string, last_last_text: string, indent_string: string, includedir: string, _this: Lexer = this;
        let whitespace: string[], wordchar: string[], punct: string[], parser_pos: number, line_starters: any[], reserved_words: any[], digits: string[], scriptpath: string;
        let input_wanted_newline: boolean, output_space_before_token: boolean, following_bracket: boolean, keep_Object_line: boolean, begin_line: boolean, tks: Token[] = [];
        let input_length: number, n_newlines: number, last_LF: number, bracketnum: number, whitespace_before_token: any[], beginpos: number, preindent_string: string;;
        let handlers: any, MODE: { BlockStatement: any; Statement: any; ArrayLiteral: any; Expression: any; ForInitializer: any; Conditional: any; ObjectLiteral: any; };

        this.document = document, this.scriptpath = decodeURIComponent(document.uri).substring(8).replace(/\/[^\/]+$/, '').toLowerCase();
        includetable = this.includetable, scriptpath = this.scriptpath;

        whitespace = "\n\r\t ".split(''), digits = '0123456789'.split(''), wordchar = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789_$'.split('');
        punct = '+ - * / % & ++ -- ** // = += -= *= /= //= .= == := != !== ~= > < >= <= >> << >>= <<= && &= | || ! ~ , : ? ^ ^= |= :: =>'.split(' ');
        line_starters = 'class,try,throw,return,global,local,static,if,switch,case,default,for,while,loop,continue,break,goto'.split(',');
        reserved_words = line_starters.concat(['extends', 'in', 'is', 'else', 'until', 'catch', 'finally', 'and', 'or']);
        MODE = { BlockStatement: 'BlockStatement', Statement: 'Statement', ObjectLiteral: 'ObjectLiteral', ArrayLiteral: 'ArrayLiteral', ForInitializer: 'ForInitializer', Conditional: 'Conditional', Expression: 'Expression' };
        handlers = {
            'TK_START_EXPR': handle_start_expr,
            'TK_END_EXPR': handle_end_expr,
            'TK_START_BLOCK': handle_start_block,
            'TK_END_BLOCK': handle_end_block,
            'TK_WORD': handle_word,
            'TK_RESERVED': handle_word,
            'TK_SEMICOLON': handle_semicolon,
            'TK_STRING': handle_string,
            'TK_EQUALS': handle_equals,
            'TK_OPERATOR': handle_operator,
            'TK_COMMA': handle_comma,
            'TK_BLOCK_COMMENT': handle_block_comment,
            'TK_INLINE_COMMENT': handle_inline_comment,
            'TK_COMMENT': handle_comment,
            'TK_DOT': handle_dot,
            'TK_HOT': handle_word2,
            'TK_SHARP': handle_word2,
            'TK_NUMBER': handle_word2,
            'TK_LABEL': handle_label,
            'TK_HOTLINE': handle_unknown,
            'TK_UNKNOWN': handle_unknown
        };

        this.beautify = function (options: any) {
            /*jshint onevar:true */
            let t: Token, i: number, keep_whitespace: boolean, sweet_code: string;
            options = options ? options : {}, opt = {};
            if (options.space_after_anon_function !== undefined && options.jslint_happy === undefined) {
                options.jslint_happy = options.space_after_anon_function;
            }
            if (options.braces_on_own_line !== undefined) { //graceful handling of deprecated option
                opt.brace_style = options.braces_on_own_line ? "expand" : "collapse";
            }
            opt.brace_style = options.brace_style ? options.brace_style : (opt.brace_style ? opt.brace_style : "collapse");
            if (opt.brace_style === "expand-strict") {
                opt.brace_style = "expand";
            }
            opt.indent_size = options.indent_size ? parseInt(options.indent_size, 10) : 4;
            opt.indent_char = options.indent_char ? options.indent_char : ' ';
            opt.preserve_newlines = (options.preserve_newlines === undefined) ? true : options.preserve_newlines;
            opt.break_chained_methods = (options.break_chained_methods === undefined) ? false : options.break_chained_methods;
            opt.max_preserve_newlines = (options.max_preserve_newlines === undefined) ? 0 : parseInt(options.max_preserve_newlines, 10);
            opt.space_in_paren = (options.space_in_paren === undefined) ? false : options.space_in_paren;
            opt.space_in_empty_paren = (options.space_in_empty_paren === undefined) ? false : options.space_in_empty_paren;
            opt.jslint_happy = (options.jslint_happy === undefined) ? false : options.jslint_happy;
            opt.keep_array_indentation = (options.keep_array_indentation === undefined) ? false : options.keep_array_indentation;
            opt.space_before_conditional = (options.space_before_conditional === undefined) ? true : options.space_before_conditional;
            opt.wrap_line_length = (options.wrap_line_length === undefined) ? 0 : parseInt(options.wrap_line_length, 10);
            if (options.indent_with_tabs) {
                opt.indent_char = '\t', opt.indent_size = 1;
            }
            indent_string = '';
            while (opt.indent_size > 0) {
                indent_string += opt.indent_char, opt.indent_size -= 1;
            }
            last_type = 'TK_START_BLOCK', last_last_text = '', output_lines = [create_output_line()];
            output_space_before_token = false, flag_store = [], flags = null, set_mode(MODE.BlockStatement), preindent_string = '';
            let source_text = this.document.getText();
            while (source_text && (source_text.charAt(0) === ' ' || source_text.charAt(0) === '\t')) {
                preindent_string += source_text.charAt(0), source_text = source_text.substring(1);
            }
            input = source_text, input_length = input.length, whitespace_before_token = [];
            following_bracket = false, begin_line = true, bracketnum = 0, parser_pos = 0, last_LF = -1;
            while (true) {
                t = get_next_token();
                token_text = t.content, token_text_low = token_text.toLowerCase();
                token_type = t.type;

                if (token_type === 'TK_EOF') {
                    // Unwind any open statements
                    while (flags.mode === MODE.Statement) {
                        restore_mode();
                    }
                    break;
                }

                keep_whitespace = opt.keep_array_indentation && is_array(flags.mode);
                input_wanted_newline = n_newlines > 0;

                if (keep_whitespace) {
                    for (i = 0; i < n_newlines; i += 1) {
                        print_newline(i > 0);
                    }
                } else {
                    if (opt.max_preserve_newlines && n_newlines > opt.max_preserve_newlines) {
                        n_newlines = opt.max_preserve_newlines;
                    }

                    if (opt.preserve_newlines) {
                        if (n_newlines > 1) {
                            // if (n_newlines && token_text !== ',') {
                            print_newline();
                            for (i = 1; i < n_newlines; i += 1) {
                                print_newline(true);
                            }
                        }
                    }
                }

                handlers[token_type]();

                // The cleanest handling of inline comments is to treat them as though they aren't there.
                // Just continue formatting and the behavior should be logical.
                // Also ignore unknown tokens.  Again, this should result in better behavior.
                if (token_type !== 'TK_INLINE_COMMENT' && token_type !== 'TK_COMMENT' &&
                    token_type !== 'TK_BLOCK_COMMENT') {
                    if (!following_bracket && token_type === 'TK_RESERVED' && in_array(token_text_low, ['if', 'for', 'while', 'loop', 'catch'])) {
                        output_space_before_token = true;
                        following_bracket = true;
                        bracketnum = 0;
                        if (in_array(token_text_low, ['if', 'while'])) {
                            set_mode(MODE.Conditional);
                        } else {
                            set_mode(MODE.ForInitializer);
                        }
                        indent();
                        last_last_text = token_text;
                        flags.last_text = '(';
                        last_type = 'TK_START_EXPR';
                    }
                    else {
                        last_last_text = flags.last_text;
                        last_type = token_type;
                        flags.last_text = token_text;
                    }
                }
                flags.had_comment = (token_type === 'TK_INLINE_COMMENT' || token_type === 'TK_COMMENT'
                    || token_type === 'TK_BLOCK_COMMENT');
            }

            sweet_code = output_lines[0].text.join('');
            for (let line_index = 1; line_index < output_lines.length; line_index++) {
                sweet_code += '\n' + output_lines[line_index].text.join('');
            }
            sweet_code = sweet_code.replace(/[\r\n ]+$/, '');
            return sweet_code;
        };

        this.parseScript = function (): void {
            input = this.document.getText(), input_length = input.length, includedir = scriptpath, tks.length = 0;
            whitespace_before_token = [], beginpos = 0, last_text = '', last_type = 'TK_BLOCK';
            following_bracket = false, begin_line = true, bracketnum = 0, parser_pos = 0, last_LF = -1, this.blocks = [];
            this.root = { statement: { assume: FuncScope.DEFAULT, global: {}, define: {} }, include: [], children: [], funccall: [] };
            for (let t in includetable) delete includetable[t];
            this.symboltree = parse(), this.root.children = this.symboltree, this.symboltree.push(...this.blocks), this.blocks = undefined;
            for (const it in this.root.statement.define) this.symboltree.push(this.root.statement.define[it]);
        }

        function parse(mode = 0, scopevar = new Map<string, any>()): DocumentSymbol[] {
            const result: DocumentSymbol[] = [];
            let tk: Token = { content: '', type: '', offset: 0, length: 0 }, lk: Token = tk, next: boolean = true, LF: number = 0;
            let blocks = 0, includefiles: { [key: string]: { url: string, uri: string, path: string } }, findvar: 0 | 1 | 2 = 1;
            let tn: DocumentSymbol | FuncNode | Variable | undefined, comment = '', sub: DocumentSymbol[];
            while (nexttoken()) {
                switch (tk.type) {
                    case 'TK_SHARP':
                        let m: any, raw = '';
                        if (m = tk.content.match(/^\s*#include(again)?\s+(<.+>|(['"])[^;]+(\.ahk2?|\.ah2)?\3)/i)) {
                            raw = m[2].trim(), m = raw.replace(/%(a_scriptdir|a_workingdir)%/i, scriptpath);
                            if (m === '') includedir = scriptpath; else if (m.match(/(>|\.ahk2?|\.ah2)$/)) includedir = m;
                            else m = pathanalyze(m, includedir + '/'), includetable[m.uri] = { url: m.url, path: m.path, raw };
                        }
                        break;
                    case 'TK_LABEL':
                        tn = SymbolNode.create(tk.content, SymbolKind.Field, makerange(tk.offset, tk.length), makerange(tk.offset, tk.length - 1)), result.push(tn);
                        if (n_newlines === 1 && (lk.type === 'TK_COMMENT' || lk.type === 'TK_BLOCK_COMMENT')) tn.detail = trimcomment(lk.content); break;
                    case 'TK_HOT':
                        tn = SymbolNode.create(tk.content, SymbolKind.Event, makerange(tk.offset, tk.length), makerange(tk.offset, tk.length - 2));
                        if (n_newlines === 1 && (lk.type === 'TK_COMMENT' || lk.type === 'TK_BLOCK_COMMENT')) tn.detail = trimcomment(lk.content);
                        lk = tk, tk = get_token_ingore_comment(comment = ''); if (tk.content === '{') sub = parse(1), tn.children = sub;
                        result.push(tn), next = false, lk = tk; break;
                    case 'TK_HOTLINE':
                        tn = SymbolNode.create(tk.content, SymbolKind.Event, makerange(tk.offset, tk.length), makerange(tk.offset, tk.length - 2));
                        if (n_newlines === 1 && (lk.type === 'TK_COMMENT' || lk.type === 'TK_BLOCK_COMMENT')) tn.detail = trimcomment(lk.content);
                        LF = input.indexOf('\n', parser_pos), parser_pos = LF > -1 ? LF + 1 : input_length, tn.range.end = document.positionAt(parser_pos - 2), result.push(tn);
                        break;
                    case 'TK_START_BLOCK': blocks++; break;
                    case 'TK_END_BLOCK': if ((--blocks) < 0) return result; break;
                    case 'TK_START_EXPR':
                        if (tk.content === '[') parsepair('[', ']');
                        else parsepair('(', ')');
                        break;
                    default: continue;
                    case 'TK_WORD':
                        addtext(tk);
                        let predot = (input.charAt(tk.offset - 1) === '.');
                        if (!predot && input.charAt(parser_pos) === '(') {
                            let comm = '';
                            if (input.charAt(tk.offset - 1) === '.') continue;
                            if (n_newlines === 1 && (lk.type === 'TK_COMMENT' || lk.type === 'TK_BLOCK_COMMENT')) comm = trimcomment(lk.content);
                            lk = tk, tk = { content: '(', offset: parser_pos, length: 1, type: 'TK_START_EXPR' }, parser_pos++;
                            let fc = lk, par = parsequt(), quoteend = parser_pos, nk = get_token_ingore_comment(), tn: FuncNode | undefined;
                            if (par) {
                                if (nk.content === '=>') {
                                    let storemode = mode;
                                    mode = mode | 1;
                                    let sub = parseline(), pars: { [key: string]: any } = {};
                                    mode = storemode;
                                    tn = FuncNode.create(fc.content, mode === 2 ? SymbolKind.Method : SymbolKind.Function, makerange(fc.offset, parser_pos - fc.offset), makerange(fc.offset, fc.length), <Variable[]>par);
                                    tn.range.end = document.positionAt(lk.offset + lk.length);
                                    tn.children = []; for (const it of par) pars[it.name.toLowerCase()] = true;
                                    for (let i = sub.length - 1; i >= 0; i--) { if (pars[sub[i].name.toLowerCase()]) tn.children.push(sub[i]), sub.splice(i, 1); }
                                    if (comm) tn.detail = comm; result.push(tn), result.push(...sub);
                                } else if (nk.content === '{' && fc.topofline) {
                                    let vars = new Map<string, any>();
                                    sub = parse(mode | 1, vars);
                                    tn = FuncNode.create(fc.content, mode === 2 ? SymbolKind.Method : SymbolKind.Function, makerange(fc.offset, parser_pos - fc.offset), makerange(fc.offset, fc.length), par, sub);
                                    if (vars.has('#assume')) tn.statement.assume = vars.get('#assume');
                                    for (const tp of ['global', 'local', 'define']) {
                                        if (vars.has('#' + tp)) {
                                            let oo: { [key: string]: Variable } = {}, _name = '';
                                            for (const it of vars.get('#' + tp)) if (!oo[_name = it.name.toLowerCase()]) oo[_name] = it;
                                            tn.statement[tp === 'global' ? 'global' : tp === 'local' ? 'local' : 'define'] = oo;
                                        }
                                    }
                                    if (comm) tn.detail = comm; result.push(tn);
                                } else {
                                    next = false, lk = tk, tk = nk;
                                    if (par) for (const it of par) if (!builtin_variable.includes(it.name.toLowerCase())) result.push(it);
                                }
                            } else next = false, lk = tk, tk = nk;
                            if (!tn) _this.root.funccall.push(DocumentSymbol.create(fc.content, undefined, SymbolKind.Function, makerange(fc.offset, quoteend - fc.offset), makerange(fc.offset, fc.length)));
                        } else {
                            if (n_newlines === 1 && (lk.type === 'TK_COMMENT' || lk.type === 'TK_BLOCK_COMMENT')) comment = trimcomment(lk.content); else comment = '';
                            lk = tk, tk = get_next_token(), next = false;
                            if (!predot && (!lk.topofline || (tk.type === 'TK_OPERATOR' && tk.content.match(/=$|\?/)) || ['TK_EQUALS', 'TK_DOT'].includes(tk.type))) addvariable(lk, mode);
                            else if (input.charAt(lk.offset + lk.length).match(/^(\s|)$/)){
                                if (lk.topofline) {
                                    let fc = lk, sub = parseline();
                                    result.push(...sub), _this.root.funccall.push(DocumentSymbol.create(fc.content, undefined, SymbolKind.Function, makerange(fc.offset, lk.offset + lk.length - fc.offset), makerange(fc.offset, fc.length)));
                                    break;
                                } else if (predot && !((tk.type === 'TK_OPERATOR' && tk.content.match(/=$|\?/)) || ['TK_EQUALS', 'TK_DOT'].includes(tk.type))) {
                                    let prestr = input.substring(last_LF + 1, lk.offset);
                                    if (prestr.match(/^\s*(\w+\.)+$/)) {
                                        let fc = lk, sub = parseline();
                                        result.push(...sub), _this.root.funccall.push(DocumentSymbol.create(fc.content, undefined, SymbolKind.Method, makerange(fc.offset, lk.offset + lk.length - fc.offset), makerange(fc.offset, fc.length)));
                                        break;
                                    }
                                }
                            }
                            if (tk.content === ':=') {
                                next = true;
                                let ep = parseexp();
                                result.push(...ep);
                            }
                            break;
                        }
                        break;
                    case 'TK_RESERVED':
                        parse_reserved(); break;
                }
            }
            return result;

            function parse_reserved() {
                let _low = '';
                switch (_low = tk.content.toLowerCase()) {
                    case 'class':
                        let cl: Token, ex: string = '', sv = new Map(), beginpos = tk.offset, comm = '';
                        if (n_newlines === 1 && (lk.type === 'TK_COMMENT' || lk.type === 'TK_BLOCK_COMMENT')) comm = trimcomment(lk.content), beginpos = lk.offset;
                        nexttoken(), cl = tk, tk = get_token_ingore_comment(); if (tk.content.toLowerCase() === 'extends') ex = get_token_ingore_comment().content, tk = get_token_ingore_comment(comment = '');
                        if (tk.content !== '{') { next = false; break; }
                        tn = DocumentSymbol.create(cl.content, undefined, SymbolKind.Class, makerange(0, 0), makerange(cl.offset, cl.length));
                        sv.set('#class', tn), tn.children = parse(2, sv), tn.range = makerange(beginpos, parser_pos - beginpos);
                        if (comm) tn.detail = comm; if (ex) (<ClassNode>tn).extends = ex;
                        (<{ [key: string]: Variable }>_this.root.statement.global)[cl.content.toLowerCase()] = tn;
                        for (const item of tn.children) if (item.children && item.kind != SymbolKind.Property) (<FuncNode>item).parent = tn;
                        result.push(tn); break;
                    case 'global':
                    case 'static':
                    case 'local':
                        lk = tk, tk = get_token_ingore_comment(comment = '');
                        if (tk.topofline) {
                            if (_low === 'global') scopevar.set('#assume', FuncScope.GLOBAL);
                            else scopevar.set('#assume', scopevar.get('#assume') | (_low === 'local' ? FuncScope.LOCAL : FuncScope.STATIC))
                        } else if (tk.type === 'TK_WORD') {
                            if (input.charAt(parser_pos) === '(') tk.topofline = true;
                            else {
                                next = false;
                                let sta = parsestatement();
                                if (_low === 'global') {
                                    if (!scopevar.has('#global')) scopevar.set('#global', sta);
                                    else (scopevar.get('#global')).push(...sta);
                                    let p: { [key: string]: Variable };
                                    if (mode === 0) {
                                        p = <{ [key: string]: Variable }>_this.root.statement.global;
                                    } else p = <{ [key: string]: Variable }>_this.root.statement.define;
                                    for (const it of sta) p[it.name.toLowerCase()] = p[it.name.toLowerCase()] || it;
                                    // if (_this.root.statement.global)
                                    // sta.map(it=>_this.root.statement.global[it.name.toLowerCase()])
                                    // sta.map(it => _this.root.statement.global[it.name.toLowerCase()] = _this.root.statement.global[it.name.toLowerCase()] || it)
                                } else {
                                    if (!scopevar.has('#local')) scopevar.set('#local', sta);
                                    else (scopevar.get('#local')).push(...sta);
                                }
                                result.push(...sta);
                            }
                        }
                        next = false;
                        break;
                    case 'loop':
                        lk = tk, tk = get_next_token();
                        if (next = (tk.type === 'TK_WORD' && ['parse', 'files', 'read', 'reg'].includes(tk.content.toLowerCase())))
                            tk.type = 'TK_RESERVED';
                        break;
                    case 'continue':
                    case 'break':
                    case 'goto':
                        lk = tk, tk = get_next_token(), next = false;
                        if (!tk.topofline && tk.type === 'TK_WORD') tk.ignore = true;
                        break;
                }
            }

            function parseline(): DocumentSymbol[] {
                let result: DocumentSymbol[] = [];
                while (nexttoken()) {
                    if (tk.topofline && !(['and', 'or'].includes(tk.content.toLowerCase()) || ['TK_COMMA', 'TK_OPERATOR', 'TK_EQUALS'].includes(tk.type))) { next = false; break; }
                    switch (tk.type) {
                        case 'TK_WORD':
                            addtext(tk);
                            if (input.charAt(tk.offset - 1) === '.') { lk = tk; continue; }
                            if (input.charAt(parser_pos) === '(') {
                                lk = tk, tk = { content: '(', offset: parser_pos, length: 1, type: 'TK_START_EXPR' }, parser_pos++;
                                let fc = lk, par = parsequt(), quoteend = parser_pos, nk = get_next_token();
                                if (nk.content === '=>') {
                                    let storemode = mode;
                                    mode = mode | 1;
                                    let sub = parseexp();
                                    mode = storemode;
                                    tn = FuncNode.create(fc.content, SymbolKind.Function, makerange(fc.offset, parser_pos - fc.offset), makerange(fc.offset, fc.length), <Variable[]>par);
                                    tn.range.end = document.positionAt(lk.offset + lk.length);
                                    for (const it of sub) result.push(it);
                                } else {
                                    _this.root.funccall.push(DocumentSymbol.create(fc.content, undefined, SymbolKind.Function, makerange(fc.offset, quoteend - fc.offset), makerange(fc.offset, fc.length)));
                                    if (par) for (const it of par) if (!builtin_variable.includes(it.name.toLowerCase())) result.push(it);
                                    lk = tk, tk = nk, next = false;
                                }
                            } else {
                                if (n_newlines === 1 && (lk.type === 'TK_COMMENT' || lk.type === 'TK_BLOCK_COMMENT')) comment = lk.content; else comment = '';
                                if (tk.topofline) {
                                    lk = tk, tk = get_next_token();
                                    if (tk.topofline || (whitespace.includes(input.charAt(lk.offset + lk.length)) && !(['TK_OPERATOR', 'TK_EQUALS'].includes(tk.type) && tk.content.match(/.=$/)))) continue;
                                    addvariable(lk, mode, result); next = false;
                                } else addvariable(tk, mode, result);
                            }
                            break;
                        case 'TK_START_EXPR':
                            if (tk.content === '[') parsepair('[', ']'); else {
                                let ptk = lk, par = parsequt(), quoteend = parser_pos, nk = get_next_token();
                                if (nk.content === '=>') {
                                    let storemode = mode;
                                    mode = mode | 1;
                                    let sub = parseexp();
                                    mode = storemode;
                                    for (const it of sub) result.push(it);
                                } else {
                                    if (ptk.type === 'TK_WORD' && input.charAt(ptk.offset + ptk.length) === '(')
                                        _this.root.funccall.push(DocumentSymbol.create(ptk.content, undefined, SymbolKind.Method, makerange(ptk.offset, quoteend - ptk.offset), makerange(ptk.offset, ptk.length)));
                                    if (par) for (const it of par) if (!builtin_variable.includes(it.name.toLowerCase())) result.push(it);
                                    lk = tk, tk = nk, next = false;
                                }
                                // parsepair('(', ')')
                            } break;
                        case 'TK_START_BLOCK': parseobj(); break;
                    }
                }
                return result;
            }

            function parsestatement() {
                let sta: DocumentSymbol[] = [], trg: Range;
                loop:
                while (nexttoken()) {
                    if (tk.topofline && !(['and', 'or'].includes(tk.content.toLowerCase()) || ['TK_COMMA', 'TK_OPERATOR', 'TK_EQUALS'].includes(tk.type))) { next = false; break; }
                    switch (tk.type) {
                        case 'TK_WORD':
                            lk = tk, tk = get_token_ingore_comment(comment = '');
                            if (tk.type === 'TK_COMMA') { addvariable(lk, mode, sta); continue; }
                            else if (tk.content === ':=') {
                                addvariable(lk, mode, sta);
                                result.push(...parseexp());
                            } else if (tk.topofline && !(['and', 'or'].includes(tk.content.toLowerCase()) || ['TK_COMMA', 'TK_OPERATOR', 'TK_EQUALS'].includes(tk.type))) {
                                addvariable(lk, mode, sta);
                                break loop;
                            }
                            break;
                        case 'TK_COMMA':
                        case 'TK_COMMENT':
                        case 'TK_BLOCK_COMMENT':
                        case 'TK_INLINE_COMMENT':
                            continue;
                        default: break loop;
                    }
                }
                return sta;
            }

            function parseexp(inpair = false) {
                let pres = result.length;
                while (nexttoken()) {
                    if (tk.topofline && !inpair && !(['and', 'or'].includes(tk.content.toLowerCase()) || ['TK_OPERATOR', 'TK_EQUALS'].includes(tk.type))) { next = false; break; }
                    switch (tk.type) {
                        case 'TK_WORD':
                            let predot = (input.charAt(tk.offset - 1) === '.');
                            if (input.charAt(parser_pos) === '(') {
                                lk = tk, tk = { content: '(', offset: parser_pos, length: 1, type: 'TK_START_EXPR' }, parser_pos++;
                                let ptk = lk, par = parsequt(), quoteend = parser_pos, nk = get_next_token();
                                if (nk.content === '=>') {
                                    let sub = parseexp();
                                } else {
                                    _this.root.funccall.push(DocumentSymbol.create(ptk.content, undefined, SymbolKind.Method, makerange(ptk.offset, quoteend - ptk.offset), makerange(ptk.offset, ptk.length)));
                                    next = false, tk = nk;
                                    if (par) for (const it of par) if (!builtin_variable.includes(it.name.toLowerCase())) result.push(it);
                                    break;
                                }
                            }
                            lk = tk, tk = get_token_ingore_comment(comment = '');
                            if (tk.topofline) {
                                next = false; if (!predot) addvariable(lk, mode); return result.splice(pres);
                            } else if (tk.content === ',') {
                                if (!predot) addvariable(lk, mode); return result.splice(pres);
                            } else if (tk.type === 'TK_OPERATOR' && input.charAt(lk.offset - 1) !== '.') {
                                if (!predot) addvariable(lk, mode); continue;
                            }
                            if (!predot) addvariable(lk, mode), next = false; break;
                        case 'TK_START_EXPR':
                            if (tk.content === '[') parsepair('[', ']'); else {
                                let fc: Token | undefined, par: any, nk: Token, quoteend: number;
                                if (lk.type === 'TK_WORD' && input.charAt(lk.offset + lk.length) === '(')
                                    if (input.charAt(lk.offset - 1) === '.') {
                                        let ptk = lk;
                                        parsepair('(', ')');
                                        _this.root.funccall.push(DocumentSymbol.create(ptk.content, undefined, SymbolKind.Method, makerange(ptk.offset, parser_pos - ptk.offset), makerange(ptk.offset, ptk.length)));
                                        continue;
                                    } else fc = lk;
                                par = parsequt(), quoteend = parser_pos, nk = get_token_ingore_comment(comment = '');
                                if (nk.content === '=>' && par) {
                                    let sub = parseexp(true), pars: { [key: string]: boolean } = {}, cds: DocumentSymbol[] = [];
                                    for (const it of par) pars[it.name.toLowerCase()] = true;
                                    for (let i = sub.length - 1; i >= 0; i--) { if (pars[sub[i].name.toLowerCase()]) cds.push(sub[i]), sub.splice(i, 1); }
                                    if (fc) result.push(FuncNode.create(fc.content, SymbolKind.Function, makerange(fc.offset, parser_pos - fc.offset), makerange(fc.offset, fc.length), par, cds));
                                    result.push(...sub);
                                    return result;
                                } else {
                                    if (fc) _this.root.funccall.push(DocumentSymbol.create(fc.content, undefined, SymbolKind.Function, makerange(fc.offset, quoteend - fc.offset), makerange(fc.offset, fc.length)));
                                    if (par) for (const it of par) if (!builtin_variable.includes(it.name.toLowerCase())) result.push(it);
                                    next = false, lk = tk, tk = nk;
                                }
                            } break;
                        case 'TK_START_BLOCK': parseobj(); break;
                        case 'TK_END_BLOCK':
                        case 'TK_END_EXPR': next = false;
                        case 'TK_COMMA': return result.splice(pres);
                    }
                }
                return result.splice(pres);
            }

            function parsequt() {
                let pairnum = 0, paramsdef = true;
                if (!tk.topofline && ((lk.type === 'TK_OPERATOR' && !lk.content.match(/(:=|\?|:)/)) || !in_array(lk.type, ['TK_START_EXPR', 'TK_WORD', 'TK_OPERATOR', 'TK_COMMA'])
                    || (lk.type === 'TK_WORD' && in_array(input.charAt(tk.offset - 1), whitespace))))
                    paramsdef = false;
                let cache = [], rg, vr, byref = false;
                if (paramsdef)
                    while (nexttoken()) {
                        if (tk.content === ')') { if ((--pairnum) < 0) break; } //else if (tk.content === '(') pairnum++;
                        else if (tk.type.indexOf('COMMENT') > -1) continue;
                        else if (tk.type === 'TK_WORD') {
                            addtext(tk);
                            if (in_array(lk.content, [',', '('])) {
                                if (tk.content.toLowerCase() === 'byref') {
                                    nexttoken();
                                    if (tk.type !== 'TK_WORD') { addvariable(lk, mode), next = false; break; } else byref = true;
                                }
                                lk = tk, tk = get_token_ingore_comment(comment = '');
                                if (tk.content === ',' || tk.content === ')') {
                                    tn = Variable.create(lk.content, SymbolKind.Variable, rg = makerange(lk.offset, lk.length), rg);
                                    if (byref) byref = false, (<Variable>tn).byref = true; cache.push(tn);
                                    if (tk.content === ')' && ((--pairnum) < 0)) break;
                                } else if (tk.content === ':=') {
                                    tk = get_token_ingore_comment(comment = '');
                                    if (tk.type === 'TK_STRING' || tk.type === 'TK_NUMBER' || (tk.type === 'TK_WORD' && ['unset', 'true', 'false'].includes(tk.content.toLowerCase()))) {
                                        tn = Variable.create(lk.content, SymbolKind.Variable, rg = makerange(lk.offset, lk.length), rg);
                                        if (byref) byref = false, (<Variable>tn).byref = true;
                                        (<Variable>tn).defaultVal = tk.content, cache.push(tn), lk = tk, tk = get_token_ingore_comment(comment = '');
                                        if (tk.type === 'TK_COMMA') continue; else if (tk.content === ')' && ((--pairnum) < 0)) break; else { paramsdef = false, next = false; break; }
                                    } else { paramsdef = false, next = false; break; }
                                } else if (tk.content === '*') {
                                    continue;
                                } else if (tk.content === '(') {
                                    next = false, paramsdef = false, parser_pos = lk.offset + lk.length, tk = lk; break;
                                } else { paramsdef = false, next = false; addvariable(lk, mode); break; }
                            } else { paramsdef = false, next = false; break; }
                        } else if (tk.content === '*' && [',', '('].includes(lk.content)) {
                            lk = tk, tk = get_next_token();
                            if (tk.content === ')') {
                                if ((--pairnum) < 0) break;
                            } else {
                                paramsdef = false, next = false; break;
                            }
                        // } else if (tk.content === '=>') {

                        } else {
                            paramsdef = false, next = false; break;
                        }
                    }
                if (!paramsdef) {
                    if (cache.length) {
                        for (const it of cache) if (!builtin_variable.includes(it.name.toLowerCase())) result.push(it); cache.length = 0;
                    }
                    parsepair('(', ')');
                    return;
                }
                return cache;
            }

            function parseobj() {
                let pairnum = 0;
                while (objkey()) objval();

                function objkey(): boolean {
                    while (nexttoken()) {
                        if (tk.content === '}') break;
                        else if (tk.content === '%') parsepair('%', '%');
                        else if (tk.type === 'TK_WORD' || tk.type.indexOf('COMMENT') > -1) continue;
                        else if (tk.type === 'TK_OPERATOR' && tk.content === ':') return true;
                        else if (tk.type === 'TK_LABEL' && tk.content.match(/^\w+:$/)) return true;
                        else break;
                    }
                    return false;
                }

                function objval() {
                    let exp = parseexp(true);
                    result.push(...exp);
                }
            }

            function parsepair(b: string, e: string) {
                let pairnum = 0, apos = result.length, tp = parser_pos, llk = lk;
                while (nexttoken()) {
                    if (b === '%' && tk.content === '(') parsepair('(', ')'); else if (tk.content === e) { if ((--pairnum) < 0) break; }
                    else if (tk.content === b) {
                        pairnum++, apos = result.length, tp = parser_pos, llk = lk;
                    } else if (tk.content === '=>') {
                        result.splice(apos);
                        lk = llk, tk = { content: '(', offset: tp - 1, length: 1, type: 'TK_START_EXPR' }, parser_pos = tp;
                        let par = parsequt(), nk = get_token_ingore_comment(comment = ''), sub = parseexp(true), pars: { [key: string]: boolean } = {};
                        if (par) {
                            for (const it of par) pars[it.name.toLowerCase()] = true;
                            for (let i = sub.length - 1; i >= 0; i--) { if (pars[sub[i].name.toLowerCase()]) sub.splice(i, 1); }
                            result.push(...sub);
                        }
                    } else if (tk.type === 'TK_WORD') {
                        addtext(tk);
                        if (input.charAt(tk.offset - 1) !== '.') {
                            if (input.charAt(parser_pos) !== '(') {
                                addvariable(tk, mode);
                            } else {
                                lk = tk, tk = { content: '(', offset: parser_pos, length: 1, type: 'TK_START_EXPR' }, parser_pos++;
                                let fc = lk, par = parsequt(), quoteend = parser_pos, nk = get_token_ingore_comment(comment = '');
                                if (nk.content === '=>') {
                                    let sub = parseexp(true);
                                    tn = FuncNode.create(fc.content, SymbolKind.Function, makerange(fc.offset, parser_pos - fc.offset), makerange(fc.offset, fc.length), <Variable[]>par, sub);
                                    tn.range.end = document.positionAt(lk.offset + lk.length), result.push(tn);
                                } else {
                                    _this.root.funccall.push(DocumentSymbol.create(fc.content, undefined, SymbolKind.Method, makerange(fc.offset, quoteend - fc.offset), makerange(fc.offset, fc.length)));
                                    next = false, lk = tk, tk = nk;
                                    if (par) for (const it of par) if (!builtin_variable.includes(it.name.toLowerCase())) result.push(it);
                                }
                            }
                        } else if (input.charAt(parser_pos) === '(') {
                            let ptk = tk;
                            tk = { content: '(', offset: parser_pos, length: 1, type: 'TK_START_EXPR' }, parser_pos++;
                            parsepair('(', ')');
                            _this.root.funccall.push(DocumentSymbol.create(ptk.content, undefined, SymbolKind.Method, makerange(ptk.offset, parser_pos - ptk.offset), makerange(ptk.offset, ptk.length)));
                        }
                    } else if (tk.type === 'TK_START_BLOCK') parseobj();
                    else if (tk.content === '[') parsepair('[', ']');
                }
            }

            function addvariable(token: Token, md: number = 0, p?: DocumentSymbol[]): boolean {
                if (token.ignore || builtin_variable.includes(token.content.toLowerCase()) || ((md & 2) && ['this', 'super'].includes(token.content.toLowerCase()))) return false;
                let rg = makerange(token.offset, token.length), tn = Variable.create(token.content, md === 2 ? SymbolKind.Property : SymbolKind.Variable, rg, rg);
                if (comment) tn.detail = comment;
                if (p) p.push(tn); else result.push(tn); return true;
            }

            function addtext(token: Token) {
                _this.texts[token.content.toLowerCase()] = token.content;
            }

            function nexttoken() {
                if (next) lk = tk, tk = get_next_token(); else next = true;
                return tk.type !== 'TK_EOF';
            }
        }

        function trimcomment(comment: string): string {
            if (comment.charAt(0) === ';') return comment.replace(/^\s*;\s*/, '');
            let c = comment.split('\n'), cc = '';
            c.slice(1, c.length - 1).map(l => {
                cc += '\n' + l.replace(/^\s*\?*\s*/, '');
            })
            return cc.substring(1);
        }

        function makerange(offset: number, length: number): Range {
            return Range.create(document.positionAt(offset), document.positionAt(offset + length));
        }

        function get_token_ingore_comment(comment?: string): Token {
            let tk: Token;
            while (true) {
                tk = get_next_token();
                switch (tk.type) {
                    case 'TK_COMMENT':
                    case 'TK_BLOCK_COMMENT':
                    case 'TK_INLINE_COMMENT':
                        comment = tk.content;
                        continue;
                }
                break;
            }
            return tk;
        }

        interface Token {
            type: string;
            content: string;
            offset: number;
            length: number;
            topofline?: boolean;
            ignore?: boolean;
        }

        function createToken(content: string, type: string, offset: number, length: number, topofline?: boolean): Token {
            return { content, type, offset, length, topofline };
        }

        function create_flags(flags_base: any, mode: any) {
            let next_indent_level = 0;
            if (flags_base) {
                next_indent_level = flags_base.indentation_level;
                if (!just_added_newline() &&
                    flags_base.line_indent_level > next_indent_level) {
                    next_indent_level = flags_base.line_indent_level;
                }
            }

            let next_flags = {
                mode: mode,
                parent: flags_base,
                last_text: flags_base ? flags_base.last_text : '',
                last_word: flags_base ? flags_base.last_word : '',
                declaration_statement: false,
                in_html_comment: false,
                multiline_frame: false,
                if_block: false,
                else_block: false,
                do_block: false,
                do_while: false,
                in_case_statement: false,
                in_case: false,
                case_body: false,
                indentation_level: next_indent_level,
                line_indent_level: flags_base ? flags_base.line_indent_level : next_indent_level,
                start_line_index: output_lines.length,
                had_comment: false,
                ternary_depth: 0
            };
            return next_flags;
        }

        // Using object instead of string to allow for later expansion of info about each line
        function create_output_line() {
            return {
                text: []
            };
        }

        function trim_output(eat_newlines = false): void {
            if (output_lines.length) {
                trim_output_line(output_lines[output_lines.length - 1], eat_newlines);

                while (eat_newlines && output_lines.length > 1 &&
                    output_lines[output_lines.length - 1].text.length === 0) {
                    output_lines.pop();
                    trim_output_line(output_lines[output_lines.length - 1], eat_newlines);
                }
            }
        }

        function trim_output_line(line: any, lines: any): void {
            while (line.text.length &&
                (line.text[line.text.length - 1] === ' ' ||
                    line.text[line.text.length - 1] === indent_string ||
                    line.text[line.text.length - 1] === preindent_string)) {
                line.text.pop();
            }
        }

        function trim(s: string): string {
            return s.replace(/^\s+|\s+$/g, '');
        }

        // we could use just string.split, but
        // IE doesn't like returning empty strings
        function split_newlines(s: string): string[] {
            //return s.split(/\x0d\x0a|\x0a/);
            s = s.replace(/\x0d/g, '');
            let out = [],
                idx = s.indexOf("\n");
            while (idx !== -1) {
                out.push(s.substring(0, idx));
                s = s.substring(idx + 1);
                idx = s.indexOf("\n");
            }
            if (s.length) {
                out.push(s);
            }
            return out;
        }

        function just_added_newline(): boolean {
            let line = output_lines[output_lines.length - 1];
            return line.text.length === 0;
        }

        function just_added_blankline(): boolean {
            if (just_added_newline()) {
                if (output_lines.length === 1) {
                    return true; // start of the file and newline = blank
                }

                let line = output_lines[output_lines.length - 2];
                return line.text.length === 0;
            }
            return false;
        }

        function allow_wrap_or_preserved_newline(force_linewrap = false): void {
            if (opt.wrap_line_length && !force_linewrap) {
                let line = output_lines[output_lines.length - 1];
                let proposed_line_length = 0;
                // never wrap the first token of a line.
                if (line.text.length > 0) {
                    proposed_line_length = line.text.join('').length + token_text.length +
                        (output_space_before_token ? 1 : 0);
                    if (proposed_line_length >= opt.wrap_line_length) {
                        force_linewrap = true;
                    }
                }
            }
            if (((opt.preserve_newlines && input_wanted_newline) || force_linewrap) && !just_added_newline()) {
                print_newline(false, true);
            }
        }

        function print_newline(force_newline = false, preserve_statement_flags = false): void {
            output_space_before_token = false;

            if (!preserve_statement_flags) {
                if (flags.last_text !== ';' && flags.last_text !== ',' && flags.last_text !== '=' && (last_type !== 'TK_OPERATOR' || in_array(flags.last_text, ['++', '--', '%']))) {
                    while (flags.mode === MODE.Statement && !flags.if_block && !flags.do_block) {
                        restore_mode();
                    }
                }
            }

            if (output_lines.length === 1 && just_added_newline()) {
                return; // no newline on start of file
            }

            if (force_newline || !just_added_newline()) {
                flags.multiline_frame = true;
                output_lines.push(create_output_line());
            }
        }

        function print_token_line_indentation(): void {
            if (just_added_newline()) {
                let line = output_lines[output_lines.length - 1];
                if (opt.keep_array_indentation && is_array(flags.mode) && input_wanted_newline) {
                    // prevent removing of this whitespace as redundundant
                    line.text.push('');
                    for (let i = 0; i < whitespace_before_token.length; i += 1) {
                        line.text.push(whitespace_before_token[i]);
                    }
                } else {
                    if (preindent_string) {
                        line.text.push(preindent_string);
                    }

                    print_indent_string(flags.indentation_level);
                }
            }
        }

        function print_indent_string(level: number): void {
            // Never indent your first output indent at the start of the file
            if (output_lines.length > 1) {
                let line = output_lines[output_lines.length - 1];

                flags.line_indent_level = level;
                for (let i = 0; i < level; i += 1) {
                    line.text.push(indent_string);
                }
            }
        }

        function print_token_space_before(): void {
            let line = output_lines[output_lines.length - 1];
            if (output_space_before_token && line.text.length) {
                let last_output = line.text[line.text.length - 1];
                if (last_output !== ' ' && last_output !== indent_string) { // prevent occassional duplicate space
                    line.text.push(' ');
                }
            }
        }

        function print_token(printable_token = ""): void {
            printable_token = printable_token || token_text;
            print_token_line_indentation();
            print_token_space_before();
            output_space_before_token = false;
            output_lines[output_lines.length - 1].text.push(printable_token);
        }

        function indent(): void {
            flags.indentation_level += 1;
        }

        function deindent(): void {
            if (flags.indentation_level > 0 &&
                ((!flags.parent) || flags.indentation_level > flags.parent.indentation_level))
                flags.indentation_level -= 1;
        }

        function remove_redundant_indentation(frame: { multiline_frame: any; start_line_index: any; }): void {
            // This implementation is effective but has some issues:
            //     - less than great performance due to array splicing
            //     - can cause line wrap to happen too soon due to indent removal
            //           after wrap points are calculated
            // These issues are minor compared to ugly indentation.
            if (frame.multiline_frame)
                return;

            // remove one indent from each line inside this section
            let index = frame.start_line_index;
            let splice_index = 0;
            let line: { text: any; };

            while (index < output_lines.length) {
                line = output_lines[index];
                index++;

                // skip empty lines
                if (line.text.length === 0) {
                    continue;
                }

                // skip the preindent string if present
                if (preindent_string && line.text[0] === preindent_string) {
                    splice_index = 1;
                } else {
                    splice_index = 0;
                }

                // remove one indent, if present
                if (line.text[splice_index] === indent_string) {
                    line.text.splice(splice_index, 1);
                }
            }
        }

        function set_mode(mode: any): void {
            if (flags) {
                flag_store.push(flags);
                previous_flags = flags;
            } else {
                previous_flags = create_flags(null, mode);
            }

            flags = create_flags(previous_flags, mode);
        }

        function is_array(mode: any): boolean {
            return mode === MODE.ArrayLiteral;
        }

        function is_expression(mode: any): boolean {
            return in_array(mode, [MODE.Expression, MODE.ForInitializer, MODE.Conditional]);
        }

        function restore_mode(): void {
            if (flag_store.length > 0) {
                previous_flags = flags;
                flags = flag_store.pop();
                if (previous_flags.mode === MODE.Statement) {
                    remove_redundant_indentation(previous_flags);
                }
            }
        }

        function start_of_object_property(): boolean {
            return flags.parent.mode === MODE.ObjectLiteral && flags.mode === MODE.Statement && flags.last_text === ':' &&
                flags.ternary_depth === 0;
        }

        function start_of_statement(): boolean {
            if ((last_type === 'TK_RESERVED' && !input_wanted_newline && in_array(flags.last_text.toLowerCase(), ['local', 'static', 'global']) && token_type === 'TK_WORD') ||
                (last_type === 'TK_RESERVED' && flags.last_text.match(/^loop|try|catch|finally$/i)) ||
                (last_type === 'TK_RESERVED' && flags.last_text.match(/^return$/i) && !input_wanted_newline) ||
                (last_type === 'TK_RESERVED' && flags.last_text.match(/^else$/i) && !(token_type === 'TK_RESERVED' && token_text_low === 'if')) ||
                (last_type === 'TK_END_EXPR' && (previous_flags.mode === MODE.ForInitializer || previous_flags.mode === MODE.Conditional)) ||
                (last_type === 'TK_WORD' && flags.mode === MODE.BlockStatement
                    && !flags.in_case && !in_array(token_type, ['TK_WORD', 'TK_RESERVED', 'TK_START_EXPR'])
                    && !in_array(token_text, ['--', '++', '%', '::'])) ||
                (flags.mode === MODE.ObjectLiteral && flags.last_text === ':' && flags.ternary_depth === 0)) {

                set_mode(MODE.Statement);
                indent();

                if (last_type === 'TK_RESERVED' && in_array(flags.last_text.toLowerCase(), ['local', 'static', 'global']) && token_type === 'TK_WORD') {
                    flags.declaration_statement = true;
                }
                // Issue #276:
                // If starting a new statement with [if, for, while, do], push to a new line.
                // if (a) if (b) if(c) d(); else e(); else f();
                if (!start_of_object_property()) {
                    allow_wrap_or_preserved_newline(token_type === 'TK_RESERVED' && flags.last_text.toLowerCase() !== 'try' && in_array(token_text_low, ['loop', 'for', 'if', 'while']));
                }

                return true;
            } else if (token_text === '=>')
                set_mode(MODE.Statement), indent(), flags.declaration_statement = true;
            return false;
        }

        function all_lines_start_with(lines: string[], c: string): boolean {
            for (let i = 0; i < lines.length; i++) {
                let line = trim(lines[i]);
                if (line.charAt(0) !== c) {
                    return false;
                }
            }
            return true;
        }

        function is_special_word(word: string): boolean {
            return in_array(word.toLowerCase(), ['case', 'return', 'loop', 'if', 'throw', 'else']);
        }

        function in_array(what: string, arr: string | any[]): boolean {
            for (let i = 0; i < arr.length; i += 1) {
                if (arr[i] === what) {
                    return true;
                }
            }
            return false;
        }

        function unescape_string(s: string): string {
            let esc = false, out = '', pos = 0, s_hex = '', escaped = 0, c = '';

            while (esc || pos < s.length) {
                c = s.charAt(pos), pos++;
                if (esc) {
                    esc = false;
                    if (c === 'x') {
                        // simple hex-escape \x24
                        s_hex = s.substr(pos, 2);
                        pos += 2;
                    } else if (c === 'u') {
                        // unicode-escape, \u2134
                        s_hex = s.substr(pos, 4);
                        pos += 4;
                    } else {
                        // some common escape, e.g \n
                        out += '\\' + c;
                        continue;
                    }
                    if (!s_hex.match(/^[0123456789abcdefABCDEF]+$/)) {
                        // some weird escaping, bail out,
                        // leaving whole string intact
                        return s;
                    }

                    escaped = parseInt(s_hex, 16);

                    if (escaped >= 0x00 && escaped < 0x20) {
                        // leave 0x00...0x1f escaped
                        if (c === 'x') {
                            out += '\\x' + s_hex;
                        } else {
                            out += '\\u' + s_hex;
                        }
                        continue;
                    } else if (escaped === 0x22 || escaped === 0x27 || escaped === 0x5c) {
                        // single-quote, apostrophe, backslash - escape these
                        out += '\\' + String.fromCharCode(escaped);
                    } else if (c === 'x' && escaped > 0x7e && escaped <= 0xff) {
                        // we bail out on \x7f..\xff,
                        // leaving whole string escaped,
                        // as it's probably completely binary
                        return s;
                    } else {
                        out += String.fromCharCode(escaped);
                    }
                } else if (c === '\\') {
                    esc = true;
                } else {
                    out += c;
                }
            }
            return out;
        }

        function is_next(find: string): boolean {
            let local_pos = parser_pos;
            let c = input.charAt(local_pos);
            while (in_array(c, whitespace) && c !== find) {
                local_pos++;
                if (local_pos >= input_length) {
                    return false;
                }
                c = input.charAt(local_pos);
            }
            return c === find;
        }

        function end_bracket_of_expression(pos: number): void {
            let pLF = input.indexOf('\n', pos);
            if (pLF === -1) {
                pLF = input_length;
            }
            let LF = input.substring(parser_pos, pLF).trim();
            if (!(LF.length === 0 || bracketnum > 0 || LF.match(/^([;#]|\/\*|(and|or|is|in)\b)/i) || (!LF.match(/^(\+\+|--|!|~|%)/) && in_array(LF.charAt(0), punct)))) {
                following_bracket = false;
                restore_mode();
                remove_redundant_indentation(previous_flags);
                last_type = 'TK_END_EXPR';
                flags.last_text = ')';
            }
        }

        function get_next_token(): Token {
            let resulting_string: string, bg: boolean = false;
            n_newlines = 0;
            if (parser_pos >= input_length) {
                return createToken('', 'TK_EOF', input_length - 1, 0, true);
            }

            let c = input.charAt(parser_pos);
            input_wanted_newline = false, whitespace_before_token = [], parser_pos += 1;

            while (in_array(c, whitespace)) {

                if (c === '\n') {
                    last_LF = parser_pos - 1;
                    if (following_bracket) {
                        end_bracket_of_expression(parser_pos);
                    }
                    n_newlines += 1, begin_line = true;
                    whitespace_before_token = [];
                } else if (n_newlines) {
                    if (c === indent_string) {
                        whitespace_before_token.push(indent_string);
                    } else if (c !== '\r') {
                        whitespace_before_token.push(' ');
                    }
                }

                if (parser_pos >= input_length) {
                    return createToken('', 'TK_EOF', input_length - 1, 0, true);
                }

                c = input.charAt(parser_pos);
                parser_pos += 1;
            }

            let offset = parser_pos - 1, len = 1;
            beginpos = offset;
            if (begin_line) {
                begin_line = false, bg = true;
                let next_LF = input.indexOf('\n', parser_pos);
                if (next_LF === -1) {
                    next_LF = input_length;
                }
                let line = input.substring(last_LF + 1, next_LF).trim();
                let m: RegExpMatchArray | null;
                if (line.indexOf('::') === -1) {

                } else if (m = line.match(/^(:(\s|\*|\?|c[01]?|[pk]\d+|s[ipe]|[brto]0?|x|z)*:[\x09\x20-\x7E]+?::)(.*)$/i)) {
                    if (m[3].trim().match(/^\{\s*(\s;.*)?$/)) {
                        parser_pos += m[1].length - 1;
                        return createToken(m[1], 'TK_HOT', offset, m[1].length, true);
                    } else {
                        last_LF = next_LF, parser_pos += m[1].length - 1, begin_line = true;
                        return createToken(m[1], 'TK_HOTLINE', offset, m[1].length, true);
                    }
                } else if (m = line.match(/^([~*]{0,2}((([<>]?[!+#^]){0,4}(`{|[\x21-\x7A\x7C-\x7E]|[a-z][a-z\d_]+))|(`;|[\x21-\x3A\x3C-\x7E]|[a-z][a-z\d_]+)\s+&\s+(`;|[\x21-\x3A\x3C-\x7E]|[a-z][a-z\d_]+))(\s+up)?::)(.*)$/i)) {
                    if (m[9].trim().match(/^([<>]?[!+#^]){0,4}(`{|[\x21-\x7A\x7C-\x7E]|[a-z][a-z\d_]+)\s*(\s;.*)?$/i)) {
                        last_LF = next_LF, begin_line = true;
                        parser_pos = input.indexOf('::', parser_pos) + m[9].length - m[9].trimLeft().length + 2;
                        return createToken(m[1].replace(/\s+/g, ' '), 'TK_HOTLINE', offset, m[1].length, true);
                    } else {
                        parser_pos = input.indexOf('::', parser_pos) + 2;
                        return createToken(m[1].replace(/\s+/g, ' '), 'TK_HOT', offset, m[1].length, true);
                    }
                }
            }

            // NOTE: because beautifier doesn't fully parse, it doesn't use acorn.isIdentifierStart.
            // It just treats all identifiers and numbers and such the same.
            if (acorn.isIdentifierChar(input.charCodeAt(parser_pos - 1))) {
                if (parser_pos < input_length) {
                    while (acorn.isIdentifierChar(input.charCodeAt(parser_pos))) {
                        c += input.charAt(parser_pos);
                        parser_pos += 1;
                        if (parser_pos === input_length) {
                            break;
                        }
                    }
                }

                // small and surprisingly unugly hack for 1E-10 representation
                if (parser_pos !== input_length && c.match(/^[0-9]+[Ee]$/) && (input.charAt(parser_pos) === '-' || input.charAt(parser_pos) === '+')) {
                    let sign = input.charAt(parser_pos);
                    parser_pos += 1, c += sign + get_next_token().content;
                    return createToken(c, 'TK_NUMBER', offset, c.length, bg);
                } else if (!(last_type === 'TK_DOT') && in_array(c.toLowerCase(), reserved_words)) {
                    if (c.match(/^in$/i)) { // hack for 'in' operator
                        return createToken(c, 'TK_OPERATOR', offset, c.length, bg);
                    }
                    return createToken(c, 'TK_RESERVED', offset, c.length, bg);
                } else if (bg && input.charAt(parser_pos) === ':') {
                    let LF = input.indexOf('\n', parser_pos);
                    if (LF > 0 && input.substring(parser_pos + 1, LF).trim().match(/^($|;)/)) {
                        parser_pos += 1;
                        return createToken(c + ':', 'TK_LABEL', offset, c.length + 1, true);
                    }
                }
                if (c.match(/^(0[xX][0-9a-fA-F]+|[0-9]+(\.[0-9]+)?)$/))
                    return createToken(c, 'TK_NUMBER', offset, c.length, bg);
                return createToken(c, 'TK_WORD', offset, c.length, bg);
            }

            if (c === '(' || c === '[') {
                if (following_bracket && c === '(') {
                    bracketnum++;
                }
                return createToken(c, 'TK_START_EXPR', offset, 1, bg);
            }

            if (c === ')' || c === ']') {
                if (following_bracket && c === ')') {
                    bracketnum--;
                }
                return createToken(c, 'TK_END_EXPR', offset, 1, bg);
            }

            if (c === '{') {
                return createToken(c, 'TK_START_BLOCK', offset, 1, bg);
            }

            if (c === '}') {
                return createToken(c, 'TK_END_BLOCK', offset, 1, bg);
            }

            if (c === ';') {
                if (following_bracket) {
                    end_bracket_of_expression(input.indexOf('\n', parser_pos));
                }
                let comment = '', comment_type = 'TK_INLINE_COMMENT';
                if (bg) {
                    comment_type = 'TK_COMMENT'
                }
                while (parser_pos <= input_length && c != '\n') {
                    comment += c;
                    c = input.charAt(parser_pos);
                    parser_pos += 1;
                }
                if (c === '\n') {
                    parser_pos--;
                    last_LF = parser_pos;
                }
                comment = comment.trimRight();
                if (bg && _this.blocks && comment.match(/^;;/)) _this.blocks.push(DocumentSymbol.create(comment.replace(/^[;\s]+/, ''), undefined, SymbolKind.Object, makerange(offset, comment.length), makerange(offset, comment.length)));
                return createToken(comment, comment_type, offset, comment.length, bg);
            }

            if (c === '/') {
                let comment = '';
                // peek for comment /* ... */
                if (input.charAt(parser_pos) === '*') {
                    parser_pos += 1;
                    let LF = input.indexOf('\n', parser_pos), b = parser_pos;
                    while (LF !== -1 && !input.substring(parser_pos, LF).match(/\*\/\s*$/)) {
                        LF = input.indexOf('\n', parser_pos = LF + 1);
                    }
                    if (LF === -1) {
                        parser_pos = input_length;
                        return createToken(input.substring(offset, input_length) + '*/', 'TK_BLOCK_COMMENT', offset, input_length - offset, bg);
                    } else {
                        parser_pos = LF + 1;
                        return createToken(input.substring(offset, LF).trimRight(), 'TK_BLOCK_COMMENT', offset, LF - offset, bg)
                    }
                    if (parser_pos < input_length) {
                        while (parser_pos < input_length && !(input.charAt(parser_pos) === '*' && input.charAt(parser_pos + 1) && input.charAt(parser_pos + 1) === '/')) {
                            c = input.charAt(parser_pos);
                            comment += c, parser_pos += 1;
                            if (parser_pos >= input_length) {
                                break;
                            }
                        }
                    }
                    parser_pos += 2;
                    return createToken('/*' + comment + '*/', 'TK_BLOCK_COMMENT', offset, parser_pos - offset, bg);
                }
            }

            if (c === "'" || c === '"') { // string
                let sep = c, esc = false;
                resulting_string = c;
                if (parser_pos < input_length) {
                    // handle string
                    while ((c = input.charAt(parser_pos)) !== sep || esc) {
                        resulting_string += c;
                        if (c === '\n') {
                            let pos = parser_pos + 1, LF = input.substring(pos, (parser_pos = input.indexOf('\n', pos)) + 1);
                            last_LF = parser_pos;
                            while (LF.trim() === '') {
                                pos = parser_pos + 1, parser_pos = input.indexOf('\n', pos);
                                if (parser_pos === -1) {
                                    resulting_string += input.substring(pos, parser_pos = input_length);
                                    return createToken(resulting_string, 'TK_STRING', offset, resulting_string.trimRight().length, bg);
                                }
                                last_LF = parser_pos, LF = input.substring(pos, parser_pos + 1);
                            }
                            let whitespace: any = LF.match(/^(\s*)\(/);
                            if (!whitespace) {
                                parser_pos = pos, n_newlines++;
                                return createToken(resulting_string = resulting_string.trimRight(), 'TK_UNKNOWN', offset, resulting_string.length, bg);
                            }
                            whitespace = whitespace[1];
                            while (LF.trim().indexOf(')' + sep) !== 0) {
                                resulting_string += LF, pos = parser_pos + 1, parser_pos = input.indexOf('\n', pos);
                                if (parser_pos === -1) {
                                    resulting_string += input.substring(pos, parser_pos = input_length);
                                    return createToken(resulting_string, 'TK_STRING', offset, parser_pos - offset, bg);
                                }
                                last_LF = parser_pos, LF = input.substring(pos, parser_pos + 1);
                            }
                            parser_pos = pos + LF.indexOf(')' + sep) + 2;
                            resulting_string += whitespace + input.substring(pos, parser_pos).trim();
                            return createToken(resulting_string, 'TK_STRING', offset, parser_pos - offset, bg);
                        }
                        if (esc) {
                            esc = false;
                        } else {
                            esc = input.charAt(parser_pos) === '`';
                        }
                        parser_pos += 1;
                        if (parser_pos >= input_length) {
                            // incomplete string/rexp when end-of-file reached.
                            // bail out with what had been received so far.
                            return createToken(resulting_string, 'TK_STRING', offset, parser_pos - offset, bg);
                        }
                    }
                }

                parser_pos += 1;
                resulting_string += sep;

                return createToken(resulting_string, 'TK_STRING', offset, parser_pos - offset, bg);
            }

            if (c === '#') {
                // Spidermonkey-specific sharp variables for circular references
                // https://developer.mozilla.org/En/Sharp_variables_in_JavaScript
                // http://mxr.mozilla.org/mozilla-central/source/js/src/jsscan.cpp around line 1935
                let sharp = '#';
                c = input.charAt(parser_pos);
                if (bg && parser_pos < input_length && !in_array(c, whitespace)) {
                    while (parser_pos < input_length && !in_array(c = input.charAt(parser_pos), whitespace)) {
                        sharp += c;
                        parser_pos += 1;
                    }
                    if ((c === ' ' || c === '\t') && sharp.match(/#(dllload|hotstring|include|requires|errorstdout)/i)) {
                        let LF = input.indexOf('\n', parser_pos);
                        if (LF === -1) {
                            LF = input_length;
                        }
                        sharp += ' ' + input.substring(parser_pos, LF).trim();
                        last_LF = parser_pos = LF;
                    }
                    return createToken(sharp, 'TK_SHARP', offset, parser_pos - offset, bg);
                }
            }

            if (c === '.') {
                let nextc = input.charAt(parser_pos);
                if (nextc === '=') {
                    parser_pos++
                    return createToken('.=', 'TK_OPERATOR', offset, 2, bg);
                }
                else if (in_array(nextc, [' ', '\t'])) {
                    return createToken(c, 'TK_OPERATOR', offset, 1, bg);
                }
                return createToken(c, 'TK_DOT', offset, 1, bg);
            }

            if (in_array(c, punct)) {
                let f = parser_pos;
                while (parser_pos < input_length && in_array(c + input.charAt(parser_pos), punct)) {
                    c += input.charAt(parser_pos);
                    parser_pos += 1;
                    if (parser_pos >= input_length) {
                        break;
                    }
                }

                if (c === ',') {
                    return createToken(c, 'TK_COMMA', offset, 1, bg);
                } else if (c === ':=') {
                    return createToken(c, 'TK_EQUALS', offset, 2, bg);
                }
                return createToken(c, 'TK_OPERATOR', offset, c.length, bg);
            }
            if (c === '`') {
                if (parser_pos < input_length) {
                    c += input.charAt(parser_pos), parser_pos++;
                }
                return createToken(c, 'TK_WORD', offset, 2, bg);
            }
            return createToken(c, 'TK_UNKNOWN', offset, c.length, bg);
        }

        function handle_start_expr(): void {
            if (start_of_statement()) {
                // The conditional starts the statement if appropriate.
            }

            let next_mode = MODE.Expression;
            if (token_text === '[') {

                if (last_type === 'TK_WORD' || flags.last_text === ')') {
                    // this is array index specifier, break immediately
                    // a[x], fn()[x]
                    if (last_type === 'TK_RESERVED' && in_array(flags.last_text.toLowerCase(), line_starters)) {
                        output_space_before_token = true;
                    }
                    set_mode(next_mode);
                    print_token();
                    indent();
                    if (opt.space_in_paren) {
                        output_space_before_token = true;
                    }
                    return;
                }

                next_mode = MODE.ArrayLiteral;
                if (is_array(flags.mode)) {
                    if (flags.last_text === '[' ||
                        (flags.last_text === ',' && (last_last_text === ']' || last_last_text === '}'))) {
                        // ], [ goes to new line
                        // }, [ goes to new line
                        if (!opt.keep_array_indentation) {
                            print_newline();
                        }
                    }
                }

            } else {
                if (last_type === 'TK_RESERVED' && in_array(flags.last_text.toLowerCase(), ['for', 'loop'])) {
                    next_mode = MODE.ForInitializer;
                } else if (last_type === 'TK_RESERVED' && in_array(flags.last_text.toLowerCase(), ['if', 'while'])) {
                    next_mode = MODE.Conditional;
                } else {
                    // next_mode = MODE.Expression;
                }
            }

            if (flags.last_text === ';' || last_type === 'TK_START_BLOCK') {
                print_newline();
            } else if (last_type === 'TK_END_EXPR' || last_type === 'TK_START_EXPR' || last_type === 'TK_END_BLOCK' || flags.last_text === '.') {
                // TODO: Consider whether forcing this is required.  Review failing tests when removed.
                allow_wrap_or_preserved_newline(input_wanted_newline);
                // do nothing on (( and )( and ][ and ]( and .(
            } else if (!(last_type === 'TK_RESERVED' && token_text === '(') && (last_type !== 'TK_WORD' || flags.last_text.match(/^#[a-z]+/i)) && last_type !== 'TK_OPERATOR') {
                output_space_before_token = true;
            } else if (last_type === 'TK_RESERVED' && (in_array(flags.last_text.toLowerCase(), line_starters) || flags.last_text.match(/^catch$/i))) {
                if (opt.space_before_conditional) {
                    output_space_before_token = true;
                }
            }

            // Support of this kind of newline preservation.
            // a = (b &&
            //     (c || d));
            if (token_text === '(') {
                if (last_type === 'TK_EQUALS' || last_type === 'TK_OPERATOR') {
                    if (!start_of_object_property()) {
                        allow_wrap_or_preserved_newline();
                    }
                }
                else if (last_type === 'TK_END_EXPR') {
                    output_space_before_token = true;
                }
                else if (last_type === 'TK_WORD') {
                    if (parser_pos > 1 && in_array(input.charAt(parser_pos - 2), [' ', '\t'])) {
                        output_space_before_token = true;
                    }
                }
                else if (flags.last_text.toLowerCase() === 'until') {
                    output_space_before_token = true;
                }
            }

            if (input_wanted_newline) {
                print_newline();
                // print_newline(false, true);
            }
            set_mode(next_mode);
            print_token();
            if (opt.space_in_paren) {
                output_space_before_token = true;
            }

            // In all cases, if we newline while inside an expression it should be indented.
            indent();
        }

        function handle_end_expr() {
            // statements inside expressions are not valid syntax, but...
            // statements must all be closed when their container closes
            while (flags.mode === MODE.Statement) {
                restore_mode();
            }

            if (flags.multiline_frame) {
                allow_wrap_or_preserved_newline(token_text === ']' && is_array(flags.mode) && !opt.keep_array_indentation);
            }

            if (opt.space_in_paren) {
                if (last_type === 'TK_START_EXPR' && !opt.space_in_empty_paren) {
                    // () [] no inner space in empty parens like these, ever, ref #320
                    trim_output();
                    output_space_before_token = false;
                } else {
                    output_space_before_token = true;
                }
            }
            if (token_text === ']' && opt.keep_array_indentation) {
                print_token();
                restore_mode();
            } else {
                restore_mode();
                print_token();
            }
            remove_redundant_indentation(previous_flags);

            // do {} while () // no statement required after
            if (flags.do_while && previous_flags.mode === MODE.Conditional) {
                previous_flags.mode = MODE.Expression;
                flags.do_block = false;
                flags.do_while = false;

            }
        }

        function handle_start_block() {
            if (following_bracket) {
                following_bracket = false;
                restore_mode();
                remove_redundant_indentation(previous_flags);
                last_type = 'TK_END_EXPR';
                flags.last_text = ')';
            }
            set_mode(MODE.BlockStatement);

            let empty_braces = is_next('}');
            let empty_anonymous_function = empty_braces && flags.last_word === 'function' &&
                last_type === 'TK_END_EXPR';

            if (opt.brace_style === "expand") {
                if (last_type !== 'TK_OPERATOR' &&
                    (empty_anonymous_function ||
                        last_type === 'TK_EQUALS' ||
                        (last_type === 'TK_RESERVED' && is_special_word(flags.last_text) && flags.last_text.toLowerCase() !== 'else'))) {
                    output_space_before_token = true;
                } else {
                    print_newline(false, true);
                }
            } else { // collapse
                if (last_type === 'TK_UNKNOWN' || last_type === 'TK_HOTLINE') {

                } else if (last_type !== 'TK_OPERATOR' && last_type !== 'TK_START_EXPR') {
                    if (input_wanted_newline || last_type === 'TK_START_BLOCK' || (input_wanted_newline && in_array(last_last_text.toLowerCase(), ['class', 'extends', 'switch']))) {
                        print_newline();
                    } else {
                        output_space_before_token = true;
                    }
                } else {
                    // if TK_OPERATOR or TK_START_EXPR
                    if (is_array(previous_flags.mode) && flags.last_text === ',') {
                        if (last_last_text === '}') {
                            // }, { in array context
                            output_space_before_token = true;
                        } else {
                            print_newline(); // [a, b, c, {
                        }
                    }
                }
            }
            print_token();
            indent();
        }

        function handle_end_block() {
            // statements must all be closed when their container closes
            while (flags.mode === MODE.Statement) {
                restore_mode();
            }
            let empty_braces = last_type === 'TK_START_BLOCK';

            if (opt.brace_style === "expand") {
                if (!empty_braces) {
                    print_newline();
                }
            } else {
                // skip {}
                if (!empty_braces) {
                    if (is_array(flags.mode) && opt.keep_array_indentation) {
                        // we REALLY need a newline here, but newliner would skip that
                        opt.keep_array_indentation = false;
                        print_newline();
                        opt.keep_array_indentation = true;
                    } else if (input_wanted_newline || !(flags.mode === MODE.ObjectLiteral && keep_Object_line)) {
                        print_newline();
                    }
                }
            }
            restore_mode();
            print_token();
        }

        function handle_word() {
            if (start_of_statement()) {
                // The conditional starts the statement if appropriate.
                switch (flags.last_word.toLowerCase()) {
                    case 'if':
                    case 'catch':
                    case 'finally':
                    case 'else':
                    case 'while':
                    case 'loop':
                    case 'for':
                        flags.declaration_statement = true;
                        break;
                    case 'try':
                        if (!input_wanted_newline && in_array(token_text_low, ['if', 'while', 'loop', 'for']))
                            restore_mode();
                        flags.declaration_statement = true;
                        break;
                }
            } else if (input_wanted_newline && !is_expression(flags.mode) &&
                (last_type !== 'TK_OPERATOR' || in_array(flags.last_text, ['--', '++', '%'])) && last_type !== 'TK_EQUALS' &&
                (opt.preserve_newlines || !(last_type === 'TK_RESERVED' && in_array(flags.last_text.toLowerCase(), ['local', 'static', 'global', 'set', 'get'])))) {
                print_newline();
            }

            if (flags.do_block && !flags.do_while) {
                if (last_type === 'TK_RESERVED' && flags.last_text.match(/^until$/i)) {
                    // do {} ## while ()
                    output_space_before_token = true;
                    print_token();
                    output_space_before_token = true;
                    flags.do_while = true;
                    return;
                } else {
                    // loop .. \n .. \n throw ..
                    // print_newline();
                    flags.do_block = false;
                }
            }

            // if may be followed by else, or not
            // Bare/inline ifs are tricky
            // Need to unwind the modes correctly: if (a) if (b) c(); else d(); else e();
            if (flags.if_block) {
                if (!flags.else_block && (token_type === 'TK_RESERVED' && token_text_low === 'else')) {
                    flags.else_block = true;
                } else {
                    if (token_text_low !== 'if') {
                        while (flags.mode === MODE.Statement) {
                            restore_mode();
                        }
                    }
                    flags.if_block = false;
                    flags.else_block = false;
                }
            }

            if (token_type === 'TK_RESERVED' && (token_text_low === 'case' || (token_text_low + input.charAt(parser_pos) === 'default:' && flags.in_case_statement))) {
                print_newline();
                if (flags.case_body || opt.jslint_happy) {
                    // switch cases following one another
                    deindent();
                    flags.case_body = false;
                }
                print_token();
                flags.in_case = true;
                flags.in_case_statement = true;
                return;
            }

            if (last_type === 'TK_COMMA' || last_type === 'TK_START_EXPR' || flags.last_text === '::') {
                if (!start_of_object_property()) {
                    allow_wrap_or_preserved_newline();
                }
            }

            prefix = 'NONE';

            if (last_type === 'TK_END_BLOCK') {
                if (!(token_type === 'TK_RESERVED' && in_array(token_text_low, ['else', 'until', 'catch', 'finally']))) {
                    prefix = 'NEWLINE';
                } else {
                    if (opt.brace_style === "expand" || opt.brace_style === "end-expand") {
                        prefix = 'NEWLINE';
                    } else {
                        prefix = 'SPACE';
                        output_space_before_token = true;
                    }
                }
            } else if (last_type === 'TK_SEMICOLON' && flags.mode === MODE.BlockStatement) {
                // TODO: Should this be for STATEMENT as well?
                prefix = 'NEWLINE';
            } else if (last_type === 'TK_SEMICOLON' && is_expression(flags.mode)) {
                prefix = 'SPACE';
            } else if (last_type === 'TK_STRING') {
                prefix = 'SPACE';
            } else if (last_type === 'TK_RESERVED' || last_type === 'TK_WORD') {
                prefix = 'SPACE';
            } else if (last_type === 'TK_START_BLOCK') {
                prefix = 'NEWLINE';
            } else if (last_type === 'TK_END_EXPR') {
                output_space_before_token = true;
                prefix = 'NEWLINE';
            }

            if (token_type === 'TK_RESERVED' && in_array(token_text_low, line_starters) && flags.last_text !== ')') {
                if (flags.last_text.match(/^else$/i)) {
                    prefix = 'SPACE';
                } else if (flags.last_text.toLowerCase() === 'try' && in_array(token_text_low, ['if', 'while', 'loop', 'for'])) {
                    prefix = 'SPACE';
                } else if (flags.last_text !== '::') {
                    prefix = 'NEWLINE';
                }
            }

            if (token_type === 'TK_RESERVED' && in_array(token_text_low, ['else', 'until', 'catch', 'finally'])) {
                if (last_type !== 'TK_END_BLOCK' || opt.brace_style === "expand" || opt.brace_style === "end-expand") {
                    print_newline();
                } else if ((token_text_low === 'else' && flags.last_word.toLowerCase() === 'if')
                    || (token_text_low === 'until' && flags.last_word.toLowerCase() === 'loop')
                    || (token_text_low === 'catch' && flags.last_word.toLowerCase() === 'try')
                    || (token_text_low === 'finally' && flags.last_word.toLowerCase() === 'catch')) {
                    trim_output(true);
                    let line = output_lines[output_lines.length - 1];
                    // If we trimmed and there's something other than a close block before us
                    // put a newline back in.  Handles '} // comment' scenario.
                    if (line.text[line.text.length - 1] !== '}') {
                        print_newline();
                    }
                    output_space_before_token = true;
                } else
                    restore_mode();
            } else if (prefix === 'NEWLINE') {
                if (last_type === 'TK_RESERVED' && is_special_word(flags.last_text)) {
                    // no newline between 'return nnn'
                    output_space_before_token = true;
                } else if (last_type !== 'TK_END_EXPR') {
                    if ((last_type !== 'TK_START_EXPR' || !(token_type === 'TK_RESERVED' && in_array(token_text_low, ['local', 'static', 'global']))) && flags.last_text !== ':') {
                        // no need to force newline on 'let': for (let x = 0...)
                        if (token_type === 'TK_RESERVED' && token_text_low === 'if' && flags.last_word.match(/^else$/i) && flags.last_text !== '{') {
                            // no newline for } else if {
                            output_space_before_token = true;
                        } else {
                            print_newline();
                        }
                    }
                } else if (token_type === 'TK_RESERVED' && in_array(token_text_low, line_starters) && flags.last_text !== ')') {
                    print_newline();
                }
                // } else if (is_array(flags.mode) && flags.last_text === ',' && last_last_text === '}') {
                //     print_newline(); // }, in lists get a newline treatment
            } else if (prefix === 'SPACE') {
                output_space_before_token = true;
            }
            print_token();
            flags.last_word = token_text;

            if (token_type === 'TK_RESERVED' && token_text_low === 'loop') {
                flags.do_block = true;
            }

            if (token_type === 'TK_RESERVED' && token_text_low === 'if') {
                flags.if_block = true;
            }
        }

        function handle_semicolon() {
            if (start_of_statement()) {
                // The conditional starts the statement if appropriate.
                // Semicolon can be the start (and end) of a statement
                output_space_before_token = false;
            }
            while (flags.mode === MODE.Statement && !flags.if_block && !flags.do_block) {
                restore_mode();
            }
            print_token();
            if (flags.mode === MODE.ObjectLiteral) {
                // if we're in OBJECT mode and see a semicolon, its invalid syntax
                // recover back to treating this as a BLOCK
                flags.mode = MODE.BlockStatement;
            }
        }

        function handle_string() {
            if (start_of_statement()) {
                // The conditional starts the statement if appropriate.
                // One difference - strings want at least a space before
                output_space_before_token = true;
            } else if (last_type === 'TK_RESERVED' || last_type === 'TK_WORD') {
                if (input_wanted_newline) {
                    print_newline();
                }
                output_space_before_token = true;
            } else if (last_type === 'TK_COMMA' || last_type === 'TK_START_EXPR' || last_type === 'TK_EQUALS' || last_type === 'TK_OPERATOR') {
                if (!start_of_object_property()) {
                    allow_wrap_or_preserved_newline();
                }
            } else {
                // print_newline();
                if (input_wanted_newline || flags.last_text === '{') {
                    print_newline();
                }
                output_space_before_token = true;
            }
            print_token();
        }

        function handle_equals() {
            if (start_of_statement()) {
                // The conditional starts the statement if appropriate.
            }

            output_space_before_token = true;
            print_token();
            output_space_before_token = true;
        }

        function handle_comma() {
            if (flags.declaration_statement) {
                if (input_wanted_newline) {
                    print_newline(false, true);
                }
                print_token();
                output_space_before_token = true;
                return;
            }

            if (last_type === 'TK_END_BLOCK' && flags.mode !== MODE.Expression) {
                print_token();
                if (flags.mode === MODE.ObjectLiteral && flags.last_text === '}') {
                    print_newline();
                } else {
                    output_space_before_token = true;
                }
            } else {
                if (flags.mode === MODE.ObjectLiteral ||
                    (flags.mode === MODE.Statement && flags.parent.mode === MODE.ObjectLiteral)) {
                    if (flags.mode === MODE.Statement) {
                        restore_mode();
                    }
                    print_token();
                    if (keep_Object_line) {
                        output_space_before_token = true;
                    } else {
                        print_newline();
                    }
                } else {
                    // EXPR or DO_BLOCK
                    if (input_wanted_newline) {
                        print_newline();
                    }
                    print_token();
                    output_space_before_token = true;
                }
            }
        }

        function handle_operator() {
            if (token_text === ':' && flags.ternary_depth === 0 && !flags.in_case) {
                // Check if this is a BlockStatement that should be treated as a ObjectLiteral
                // if (flags.mode === MODE.BlockStatement && last_last_text === '{' && (last_type === 'TK_WORD' || last_type === 'TK_RESERVED')) {
                if (flags.mode === MODE.BlockStatement && last_last_text === '{') {
                    flags.mode = MODE.ObjectLiteral, keep_Object_line = true;
                    let pos = parser_pos - 1, c = '';
                    while (pos >= 0 && (c = input.charAt(pos)) !== '{') {
                        if (c === '\n') {
                            keep_Object_line = false;
                            break;
                        }
                        pos--;
                    }
                    if (keep_Object_line && output_lines.length > 1) {
                        let t = output_lines.pop();
                        output_lines[output_lines.length - 1].text.push(t?.text.join('').trim());
                    }
                }
            }

            if (start_of_statement() && token_text === '%') {
                // The conditional starts the statement if appropriate.
                switch (flags.last_word.toLowerCase()) {
                    case 'if':
                    case 'catch':
                    case 'finally':
                    case 'else':
                        flags.declaration_statement = true;
                        break;
                    case 'try':
                        if (!input_wanted_newline && in_array(token_text_low, ['if', 'while', 'loop', 'for']))
                            restore_mode();
                        flags.declaration_statement = true;
                        break;
                }
            }

            let space_before = true;
            let space_after = true;
            if (last_type === 'TK_RESERVED' && is_special_word(flags.last_text)) {
                // "return" had a special handling in TK_WORD. Now we need to return the favor
                output_space_before_token = true;
                print_token();
                return;
            }

            if (token_text === ':' && flags.in_case) {
                flags.case_body = true;
                indent(); print_token();
                let local_pos = parser_pos, c = '';
                while (local_pos < input_length && in_array(c = input.charAt(local_pos), [' ', '\t']))
                    local_pos++;
                parser_pos = local_pos;
                if (c == '\r' || c == '\n') {
                    print_newline();
                } else if (c == ';') {
                    let t = get_next_token();
                    token_text = t.content; output_space_before_token = true;
                    print_token(); print_newline();
                } else output_space_before_token = true;
                flags.in_case = false;
                return;
            }

            if (token_text === '::') {
                // no spaces around exotic namespacing syntax operator
                print_token();
                return;
            }

            // http://www.ecma-international.org/ecma-262/5.1/#sec-7.9.1
            // if there is a newline between -- or ++ and anything else we should preserve it.
            if (input_wanted_newline && (token_text === '--' || token_text === '++')) {
                print_newline(false, true);
            }

            // Allow line wrapping between operators
            if (last_type === 'TK_OPERATOR') {
                allow_wrap_or_preserved_newline();
            }

            if (in_array(token_text, ['--', '++', '!', '%']) || (in_array(token_text, ['-', '+']) && (in_array(last_type, ['TK_START_BLOCK', 'TK_START_EXPR', 'TK_EQUALS', 'TK_OPERATOR']) || in_array(flags.last_text.toLowerCase(), line_starters) || flags.last_text === ','))) {
                // unary operators (and binary +/- pretending to be unary) special cases
                space_before = false;
                space_after = false;

                if (flags.last_text === ';' && is_expression(flags.mode)) {
                    // for (;; ++i)
                    //        ^^^
                    space_before = true;
                }

                if (last_type === 'TK_RESERVED') {
                    space_before = true;
                }

                if (token_text === '%') {
                    if (in_array(input.charAt(parser_pos - 2), [' ', '\t'])) {
                        space_before = true;
                    }
                    if (in_array(input.charAt(parser_pos), [' ', '\t'])) {
                        space_after = true;
                    }
                    if (input_wanted_newline) {
                        output_space_before_token = false;
                        print_newline(false, flags.declaration_statement);
                    }
                    else {
                        output_space_before_token = output_space_before_token || space_before;
                    }
                    print_token();
                    output_space_before_token = space_after;
                    return;
                }
                if ((flags.mode === MODE.BlockStatement || flags.mode === MODE.Statement) && (flags.last_text === '{' || flags.last_text === ';')) {
                    // { foo; --i }
                    // foo(); --bar;
                    print_newline();
                }
            } else if (token_text === ':') {
                if (flags.ternary_depth === 0) {
                    if (flags.mode === MODE.BlockStatement) {
                        flags.mode = MODE.ObjectLiteral;
                    }
                    space_before = false;
                } else {
                    flags.ternary_depth -= 1;
                }
            } else if (token_text === '?') {
                flags.ternary_depth += 1;
            } else if (token_text === '&') {
                if (last_type !== 'TK_WORD' && last_type !== 'TK_END_EXPR') {
                    space_after = false;
                }
            } else if (token_text === '*') {
                if (flags.last_text === '(' || (flags.last_type === 'TK_WORD' && is_next(')'))) {
                    space_before = false;
                }
                if (input.charAt(parser_pos) === ')') {
                    space_after = false;
                }
            }
            if (input_wanted_newline) {
                output_space_before_token = false;
                print_newline(false, true);
            }
            else {
                output_space_before_token = output_space_before_token || space_before;
            }
            print_token();
            output_space_before_token = space_after;
        }

        function handle_block_comment() {
            let lines = split_newlines(token_text);
            let j: number; // iterator for this case
            let javadoc = lines[0].match(/^\/\*@ahk2exe-keep/i) ? false : true;

            // block comment starts with a new line
            print_newline(false, true);

            // first line always indented
            print_token(lines[0]);
            for (j = 1; j < lines.length - 1; j++) {
                print_newline(false, true);
                if (javadoc) {
                    print_token(' * ' + lines[j].replace(/^[\s\*]+|\s+$/g, ''));
                } else {
                    print_token(lines[j].trim());
                }
            }
            if (lines.length > 1) {
                print_newline(false, true);
                print_token(' ' + trim(lines[lines.length - 1]));
            }
            // for comments of more than one line, make sure there's a new line after
            print_newline(false, true);
        }

        function handle_inline_comment() {
            // print_newline(false, true);
            output_space_before_token = true;
            print_token();
            output_space_before_token = true;
        }

        function handle_comment() {
            if (input_wanted_newline) {
                print_newline();
            }
            //  else {
            //     trim_output(true);
            // }
            print_token();
            // print_newline(false, true);
        }

        function handle_dot() {
            if (start_of_statement()) {
                // The conditional starts the statement if appropriate.
            }

            if (last_type === 'TK_RESERVED' && is_special_word(flags.last_text)) {
                output_space_before_token = true;
            } else {
                // allow preserved newlines before dots in general
                // force newlines on dots after close paren when break_chained - for bar().baz()
                allow_wrap_or_preserved_newline(flags.last_text === ')' && opt.break_chained_methods);
            }
            print_token();
        }

        function handle_word2() {
            token_type = 'TK_WORD';
            handle_word();
        }

        function handle_label() {
            print_newline();
            print_token();
            let t = output_lines[output_lines.length - 1].text;
            if (t[0].trim() === '')
                output_lines[output_lines.length - 1].text = t.slice(1);
            else
                indent();
            token_text = '::';
        }

        function handle_unknown() {
            if (input_wanted_newline && (last_type === 'TK_HOTLINE' || !just_added_newline()))
                print_newline(n_newlines === 1);
            print_token();
            if (token_type === 'TK_HOTLINE')
                output_lines[output_lines.length - 1].text.push(input.substring(parser_pos, last_LF).trimRight()), parser_pos = last_LF + 1;
            print_newline();
        }
    }

    public getWordAtPosition(position: Position, full: boolean = false): { text: string, range: Range } {
        let start = position.character, l = position.line;
        let line = this.document.getText(Range.create(Position.create(l, 0), Position.create(l + 1, 0)));
        let len = line.length, end = start;
        while (end < len && acorn.isIdentifierChar(line.charCodeAt(end)))
            end++;
        for (start = position.character - 1; start >= 0; start--)
            if ((!full || line.charAt(start) !== '.') && !acorn.isIdentifierChar(line.charCodeAt(start)))
                break;
        if (start + 1 < end)
            return { text: line.substring(start + 1, end), range: Range.create(Position.create(l, start + 1), Position.create(l, end)) };
        return { text: '', range: Range.create(position, position) };
    }

    public searchNode(name: string, position: Position, kind?: SymbolKind | SymbolKind[], root?: DocumentSymbol[])
        : DocumentSymbol | null {
        let node: DocumentSymbol | null = null, temp: any, { line, character } = position, same = false;
        if (!root) root = this.symboltree;
        if (kind === SymbolKind.Method || kind === SymbolKind.Property) {

        } else {
            for (const item of root) {
                if (((same = (item.range.start.line === item.range.end.line)) && item.range.start.line === line && character >= item.range.start.character && character <= item.range.end.character)
                    || (!same && line >= item.range.start.line && line <= item.range.end.line)) {
                    if (iskinds(item.kind, kind) && item.name.toLowerCase() === name) {
                        for (const first of root) if (item.kind === first.kind && first.name.toLowerCase() === name) return node = first;
                        return node = item;
                    } else if (item.children) {
                        if ((item.kind === SymbolKind.Function || item.kind === SymbolKind.Method) && iskinds(SymbolKind.Variable, kind)) {
                            for (const it of (<FuncNode>item).params) if (it.name.toLowerCase() === name) return node = it;
                            for (const stt of [(<FuncNode>item).statement.global, (<FuncNode>item).statement.define, (<FuncNode>item).statement.local])
                                for (const key in stt) if (key === name) return node = stt[key];
                            if (!((<FuncNode>item).statement.assume & FuncScope.LOCAL) && this.root.statement.global)
                                for (const key in this.root.statement.global) if (key.toLowerCase() === name) return node = this.root.statement.global[key];
                        }
                        if (temp = this.searchNode(name, position, kind, item.children)) return node = temp;
                    }
                }
                if (!node && iskinds(item.kind, kind) && item.name.toLowerCase() === name) node = item;
            }
        }
        return node;

        function iskinds(kind: SymbolKind, kinds?: SymbolKind | SymbolKind[]): boolean {
            if (kinds === undefined) return true;
            else if (typeof kinds === 'object') {
                for (let it of kinds) if (it === kind) return true;
                return false;
            } else return kinds === kind;
        }
    }

    public buildContext(position: Position, full: boolean = true) {
        let word = this.getWordAtPosition(position, full), linetext = '';
        let { line, character } = word.range.end, pre = '', kind: SymbolKind = SymbolKind.Variable;
        if (word.range.start.character)
            pre = this.document.getText(Range.create(line, 0, line, word.range.start.character)).trim();
        let suf = this.document.getText(Range.create(line, character, line + 1, 0));
        if (word.text.indexOf('.') === -1) {
            if (suf.match(/^\(/) || (pre === '' && suf.match(/^\s*([\w,]|$)/)))
                kind = SymbolKind.Function;
        } else if (suf.match(/^\(/) || (pre === '' && suf.match(/^\s*([\w,]|$)/)))
            kind = SymbolKind.Method;
        else
            kind = SymbolKind.Property;
        linetext = this.document.getText(Range.create(line, 0, line + 1, 0)), suf = suf.trimRight();
        return { text: word.text, range: word.range, kind, pre, suf, linetext };
    }

    public getNodeAtPosition(position: Position): DocumentSymbol | null {
        let node: DocumentSymbol | null = null, context = this.buildContext(position);
        if (context) node = this.searchNode(context.text.toLowerCase(), context.range.end, context.kind);
        return node;
    }

    public searchScopedNode(position: Position, root?: DocumentSymbol[]): DocumentSymbol | undefined {
        let { line, character } = position, its: DocumentSymbol[] | undefined = undefined, it: DocumentSymbol | undefined;
        if (!root) root = this.cache;
        for (const item of root) {
            if ((item.range.start.line === line && item.range.start.line === item.range.end.line && character >= item.range.start.character && character <= item.range.end.character)
                || (item.range.end.line > item.range.start.line && line >= item.range.start.line && line <= item.range.end.line))
                if (item.kind !== SymbolKind.Variable && (its = item.children))
                    if (!(it = this.searchScopedNode(position, its))) return item;
        }
        return it;
    }

    public getScopeChildren(scopenode?: DocumentSymbol) {
        let p: DocumentSymbol | undefined, nodes: DocumentSymbol[] = [], it: DocumentSymbol, vars: { [key: string]: any } = {}, _l = '';
        if (scopenode) {
            let { variables } = <FuncNode>scopenode;
            if (variables) for (it of variables) nodes.push(it);
            for (it of (<FuncNode>scopenode).params) if (vars[_l = it.name.toLowerCase()]) continue; else vars[_l] = true, nodes.push(it);
            if (scopenode.children) for (it of scopenode.children) {
                if (it.kind === SymbolKind.Variable)
                    if (vars[_l = it.name.toLowerCase()]) continue; else vars[_l] = true;
                nodes.push(it);
            }
            p = (<FuncNode>scopenode).parent;
            while (p && p.children && (p.kind === SymbolKind.Function || p.kind === SymbolKind.Method)) {
                for (it of (<FuncNode>p).params) if (vars[_l = it.name.toLowerCase()]) continue; else vars[_l] = true, nodes.push(it);
                for (it of p.children) {
                    if (it.kind === SymbolKind.Event) continue;
                    if (it.kind === SymbolKind.Variable)
                        if (vars[_l = it.name.toLowerCase()]) continue; else vars[_l] = true;
                    nodes.push(it);
                }
                scopenode = p, p = (<FuncNode>p).parent;
            }
            nodes.push(scopenode);
            if (!((<FuncNode>scopenode).statement.assume & FuncScope.LOCAL))
                for (const key in this.root.statement.global)
                    if (vars[_l = (it = this.root.statement.global[key]).name.toLowerCase()]) continue; else vars[_l] = true, nodes.push(it);
            return nodes;
        } else {
            for (const it of this.symboltree) {
                if (it.kind === SymbolKind.Event) continue;
                if (it.kind === SymbolKind.Variable || it.kind === SymbolKind.Class)
                    if (vars[_l = it.name.toLowerCase()]) continue; else vars[_l] = true;
                nodes.push(it);
            }
            return nodes;
        }
    }
}