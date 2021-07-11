import { PathLike, promises as fs } from "fs";
import { PEFile } from "./lib/PEFile";

export type File = Buffer | PathLike;

export interface Properties extends Record<string, string | undefined> {
    CompanyName?: string;
    FileDescription?: string;
    FileVersion?: string;
    InternalName?: string;
    LegalCopyright?: string;
    OriginalFilename?: string;
    ProductName?: string;
    ProductVersion?: string;
}

const getPEFile = async (data: File): Promise<PEFile> => {
    if (typeof data === "string") data = await fs.readFile(data);
    return new PEFile(data as Buffer);
};

export const getFileVersion = async (data: File): Promise<string> => {
    const info = (await getPEFile(data)).VS_FIXED_FILE_INFO[0];

    return [
        info.FileVersionMS >> 16,
        info.FileVersionMS & 0xffff,
        info.FileVersionLS >> 16,
        info.FileVersionLS & 0xffff,
    ].join(".");
};

export const getProductVersion = async (data: File): Promise<string> => {
    const info = (await getPEFile(data)).VS_FIXED_FILE_INFO[0];

    return [
        info.ProductVersionMS >> 16,
        info.ProductVersionMS & 0xffff,
        info.ProductVersionLS >> 16,
        info.ProductVersionLS & 0xffff,
    ].join(".");
};

export const getFileProperties = async (data: File): Promise<Properties> => {
    return (await getPEFile(data)).FILE_INFO[0][0].StringTable[0].entries as Properties;
};
