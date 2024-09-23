/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable no-async-promise-executor */
import { promises as fs, existsSync } from 'fs';

export enum DIRECTORY_ENTRY {
	IMAGE_DIRECTORY_ENTRY_EXPORT = 0, IMAGE_DIRECTORY_ENTRY_IMPORT = 1, IMAGE_DIRECTORY_ENTRY_RESOURCE = 2, IMAGE_DIRECTORY_ENTRY_EXCEPTION = 3, IMAGE_DIRECTORY_ENTRY_SECURITY = 4, IMAGE_DIRECTORY_ENTRY_BASERELOC = 5, IMAGE_DIRECTORY_ENTRY_DEBUG = 6, IMAGE_DIRECTORY_ENTRY_COPYRIGHT = 7, IMAGE_DIRECTORY_ENTRY_GLOBALPTR = 8, IMAGE_DIRECTORY_ENTRY_TLS = 9, IMAGE_DIRECTORY_ENTRY_LOAD_CONFIG = 10, IMAGE_DIRECTORY_ENTRY_BOUND_IMPORT = 11, IMAGE_DIRECTORY_ENTRY_IAT = 12, IMAGE_DIRECTORY_ENTRY_DELAY_IMPORT = 13, IMAGE_DIRECTORY_ENTRY_COM_DESCRIPTOR = 14, IMAGE_DIRECTORY_ENTRY_RESERVED = 15
}
export enum RESOURCE_TYPE {
	CURSOR = 1, BITMAP = 2, ICON = 3, MENU = 4, DIALOG = 5, STRING = 6, FONTDIR = 7, FONT = 8, ACCELERATOR = 9, RCDATA = 10, MESSAGETABLE = 11, GROUP_CURSOR = 12, GROUP_ICON = 14, VERSION = 16, DLGINCLUDE = 17, PLUGPLAY = 19, VXD = 20, ANICURSOR = 21, ANIICON = 22, HTML = 23, MANIFEST = 24
}

type ExportInfo = { Module: string; Functions: { Name: string; EntryPoint: string; Ordinal: number; }[]; OrdinalBase: number; }
export class PEFile {
	public close = () => { };
	public is_bit64: Promise<boolean>;
	private reader: () => Promise<{
		read(offset: number, length: number): Promise<Buffer>,
		readString(pos: number): Promise<string>,
		readUInt16LE(offset?: number): Promise<number>,
		readUInt32LE(offset?: number): Promise<number>,
		RVA2Offset(addr: number): number
	}>;
	private resource: Record<number, any> = {};
	private dataDirectory: { virtualAddress: number, size: number, data?: any }[] = [];
	private sectionTable: { virtualAddress: number, sizeOfRawData: number, pointerToRawData: number }[] = [];
	constructor(path: string) {
		const sizeOfSectionHdr = 40, buf = Buffer.alloc(4096);
		let ntHeadersOffset: number, optionalHeaderOffset: number;
		let fd: fs.FileHandle, reader;
		this.is_bit64 = new Promise(async (resolve, reject) => {
			try {
				fd = await fs.open(path, 'r');
				this.close = () => fd?.close();
				if (await readUInt16LE(0) !== 0x5a4d)
					throw Error('no MS-DOS stub');
				ntHeadersOffset = await readUInt32LE(60);
				if (await readUInt32LE(ntHeadersOffset) !== 0x4550)
					throw Error('no PE file');
				optionalHeaderOffset = ntHeadersOffset + 24;
				resolve(await readUInt16LE(optionalHeaderOffset) === 0x20b);
			} catch (e) { fd?.close(); return reject(e); }
		});
		this.reader = () => reader ??= new Promise(async (resolve, reject) => {
			try {
				const is_bit64 = await this.is_bit64;
				const dataDirectoryOffset = optionalHeaderOffset + (is_bit64 ? 112 : 96);
				const numberOfRvaAndSize = await readUInt32LE(dataDirectoryOffset - 4);
				const numberOfSections = await readUInt16LE(ntHeadersOffset + 6);
				const sizeOfOptionalHeader = await readUInt16LE(ntHeadersOffset + 20);
				let rawBytes = Buffer.alloc(sizeOfSectionHdr * numberOfSections);
				const { dataDirectory, sectionTable } = this;
				if ((await fd.read(rawBytes, 0, rawBytes.length, optionalHeaderOffset + sizeOfOptionalHeader)).bytesRead !== rawBytes.length)
					throw Error('bad PE file');
				for (let i = 0, offset = 0; i < numberOfSections; i++, offset += 40) {
					const virtualAddress = rawBytes.readUInt32LE(offset + 12), sizeOfRawData = rawBytes.readUInt32LE(offset + 16), pointerToRawData = rawBytes.readUInt32LE(offset + 20);
					sectionTable.push({ virtualAddress, sizeOfRawData, pointerToRawData });
				}
				this.sectionTable = sectionTable.sort((a, b) => b.virtualAddress - a.virtualAddress);
				rawBytes = Buffer.alloc(8 * numberOfRvaAndSize);
				if ((await fd.read(rawBytes, 0, rawBytes.length, dataDirectoryOffset)).bytesRead !== rawBytes.length)
					throw Error('bad PE file');
				for (let i = 0, offset = 0; i < numberOfRvaAndSize; i++, offset += 8)
					dataDirectory.push({ virtualAddress: rawBytes.readUInt32LE(offset), size: rawBytes.readUInt32LE(offset + 4) });
				resolve({ readUInt16LE, readUInt32LE, RVA2Offset, read, readString });
				function RVA2Offset(addr: number) {
					const it = sectionTable.find(a => addr >= a.virtualAddress);
					if (!it || addr >= it.virtualAddress + it.sizeOfRawData)
						throw Error('out of range');
					return addr - it.virtualAddress + it.pointerToRawData;
				}
				async function readString(pos: number) {
					await fd.read(buf, 0, buf.length, RVA2Offset(pos));
					return buf.subarray(0, buf.indexOf(Buffer.alloc(1))).toString();
				}
			} catch (e) {
				this.close();
				return reject(e);
			}
		});
		async function read(offset: number, length: number) { return (await fd.read(Buffer.alloc(length), 0, length, offset)).buffer; }
		async function readUInt16LE(offset: number) { await fd.read(buf, 0, 2, offset); return buf.readUInt16LE(0); }
		async function readUInt32LE(offset: number) { await fd.read(buf, 0, 4, offset); return buf.readUInt32LE(0); }
	}
	async getExport() {
		const fd = await this.reader(), resinfo = this.dataDirectory[DIRECTORY_ENTRY.IMAGE_DIRECTORY_ENTRY_EXPORT];
		if (!resinfo?.virtualAddress)
			return;
		if (resinfo.data)
			return resinfo.data as ExportInfo;
		const baseRva = resinfo.virtualAddress, endOfSection = baseRva + resinfo.size;
		const buf = await fd.read(fd.RVA2Offset(baseRva), 0x28);
		const modNamePtr = buf.readUInt32LE(0x0c);
		const OrdinalBase = buf.readUInt32LE(0x10);
		const funcCount = buf.readUInt32LE(0x14);
		let nameCount = buf.readUInt32LE(0x18);
		const funcTblOffset = fd.RVA2Offset(buf.readUInt32LE(0x1c));
		let nameTblOffset = fd.RVA2Offset(buf.readUInt32LE(0x20));
		let ordTblOffset = fd.RVA2Offset(buf.readUInt32LE(0x24));
		const Exports: ExportInfo = { Module: await fd.readString(modNamePtr), Functions: [], OrdinalBase }, ordinalList: Record<number, boolean> = {};
		for (let i = 0; i < nameCount; i++) {
			const nameOffset = await fd.readUInt32LE(nameTblOffset), ordinal = await fd.readUInt16LE(ordTblOffset), fnOffset = await fd.readUInt32LE(funcTblOffset + ordinal * 4);
			nameTblOffset += 4, ordTblOffset += 2, ordinalList[ordinal] = true;
			const EntryPoint = fnOffset > baseRva && fnOffset < endOfSection ? await fd.readString(fnOffset) : '0x' + (fnOffset + 0x100000000).toString(16).substring(1);
			Exports.Functions.push({ Name: await fd.readString(nameOffset), EntryPoint, Ordinal: OrdinalBase + ordinal });
		}
		for (let ordinal = 0; nameCount < funcCount; ordinal++, nameCount++) {
			while (ordinalList[ordinal]) ordinal++;
			const fnOffset = await fd.readUInt32LE(funcTblOffset + ordinal * 4);
			const EntryPoint = fnOffset > baseRva && fnOffset < endOfSection ? await fd.readString(fnOffset) : '0x' + (fnOffset + 0x100000000).toString(16).substring(1);
			ordinalList[ordinal] = true, Exports.Functions.splice(ordinal, 0, { Name: '', EntryPoint, Ordinal: OrdinalBase + ordinal });
		}
		return resinfo.data = Exports;
	}
	async getImport() {
		const fd = await this.reader(), resinfo = this.dataDirectory[DIRECTORY_ENTRY.IMAGE_DIRECTORY_ENTRY_IMPORT];
		if (!resinfo?.virtualAddress)
			return;
		if (resinfo.data)
			return resinfo.data;
		const baseOffset = fd.RVA2Offset(resinfo.virtualAddress);
		let nameOffset = await fd.readUInt32LE(baseOffset + 0x0c), firstThunk = await fd.readUInt32LE(baseOffset + 0x10);
		let ptrsize = 4, offset = baseOffset, readPtr;
		let ffff: any, IMAGE_ORDINAL_FLAG: any, ordinal: any;
		if (await this.is_bit64)
			ptrsize = 8, ffff = BigInt(0xffff), IMAGE_ORDINAL_FLAG = BigInt('0x8000000000000000'), readPtr = async (offset: number) => (await fd.read(offset, 8)).readBigUInt64LE();
		else ffff = 0xffff, IMAGE_ORDINAL_FLAG = 0x80000000, readPtr = fd.readUInt32LE;
		const Imports: Record<string, string[]> = {};
		while (firstThunk) {
			const dllname = await fd.readString(nameOffset), arr = Imports[dllname] ??= [];
			for (let i = 0; (ordinal = await readPtr(fd.RVA2Offset(firstThunk + i * ptrsize))); i++)
				arr.push(ordinal & IMAGE_ORDINAL_FLAG ? `Ordinal#${ordinal & ffff}` : await fd.readString(Number(ordinal) + 2));
			offset += 20;
			nameOffset = await fd.readUInt32LE(offset + 0x0c);
			firstThunk = await fd.readUInt32LE(offset + 0x10);
		}
		return resinfo.data = Imports;
	}
	async getResource(...types: RESOURCE_TYPE[]): Promise<any> {
		const fd = await this.reader(), resinfo = this.dataDirectory[DIRECTORY_ENTRY.IMAGE_DIRECTORY_ENTRY_RESOURCE];
		if (!resinfo?.virtualAddress)
			return;
		if (types.length === 1 && this.resource[types[0]])
			return this.resource[types[0]];
		const baseOffset = fd.RVA2Offset(resinfo.virtualAddress), dirs = [baseOffset], resources: Record<number, any> = {};
		types.forEach(type => this.resource[type] ??= resources[type] = []);
		resources[RESOURCE_TYPE.RCDATA] &&= this.resource[RESOURCE_TYPE.RCDATA] = {};
		await parseResourcesDirectory(baseOffset);
		types.forEach(type => resources[type] ??= this.resource[type]);
		return types.length === 1 ? resources[types[0]] : resources;

		async function parseResourcesDirectory(offset: number, level = 0): Promise<any> {
			const resourceDir = {
				// Characteristics: await fd.readUInt32LE(offset),	
				// TimeDateStamp: await fd.readUInt32LE(offset + 4),	
				// MajorVersion: await fd.readUInt16LE(offset + 8),		
				// MinorVersion: await fd.readUInt16LE(offset + 10),		
				NumberOfNamedEntries: await fd.readUInt16LE(offset + 12),
				NumberOfIdEntries: await fd.readUInt16LE(offset + 14)
			};
			const dirEntries = [], numberOfEntries = resourceDir.NumberOfIdEntries + resourceDir.NumberOfNamedEntries;
			offset += 16
			for (let i = 0; i < numberOfEntries; i++, offset += 8) {
				const name = await fd.readUInt32LE(offset)
				if (level === 0 && !resources[name & 0x0000ffff])
					continue;
				const offsetToData = await fd.readUInt32LE(offset + 4), entry = {
					name, id: name & 0x0000ffff, pad: name & 0xffff0000, nameOffset: name & 0x7fffffff,
					offsetToData, dataIsDirectory: Boolean((offsetToData & 0x80000000) >> 31),
					offsetToDirectory: offsetToData & 0x7fffffff
				};
				let entryName, entryId;
				if ((name & 0x80000000) >> 31) {	// nameIsString
					const offset = baseOffset + entry.nameOffset, length = await fd.readUInt16LE(offset);
					entryName = (await fd.read(offset + 2, length * 2)).toString('utf16le');
				} else
					entryId = name;
				if (entry.dataIsDirectory) {
					if (dirs.includes(baseOffset + entry.offsetToDirectory))
						break;
					dirs.push(baseOffset + entry.offsetToDirectory);
					const entryDirectory = await parseResourcesDirectory(baseOffset + entry.offsetToDirectory, level + 1);
					if (entryDirectory === undefined)
						break;
					dirEntries.push({ struct: entry, id: entryId, name: entryName, directory: entryDirectory });
				} else {
					const offset = baseOffset + entry.offsetToDirectory;
					const struct = {
						offsetToData: await fd.readUInt32LE(offset),
						size: await fd.readUInt32LE(offset + 4),
						codePage: await fd.readUInt32LE(offset + 8),
						reserved: await fd.readUInt32LE(offset + 12)
					};
					const entryData = {
						struct: struct, lang: entry.name & 0x3ff, subLang: entry.name >> 10
					}
					dirEntries.push({ struct: entry, id: entryId, name: entryName, data: entryData });
				}
				if (level === 0) {
					const lastEntry = dirEntries[dirEntries.length - 1];
					if (entry.id === RESOURCE_TYPE.VERSION) {
						const versionEntries = lastEntry.directory?.entries[0].directory?.entries ?? [];
						for (const versionEntry of versionEntries) {
							const rtVersionStruct = versionEntry.data?.struct;
							if (rtVersionStruct)
								await parseVersionInformation(resources[16], rtVersionStruct);
						}
					} else if (entry.id === RESOURCE_TYPE.MANIFEST) {
						const manifestEntries = lastEntry.directory?.entries[0].directory?.entries ?? [];
						for (const manifestEntrie of manifestEntries) {
							const manifestStruct = manifestEntrie.data?.struct;
							if (manifestStruct?.size)
								resources[24].push(await parseUTF8String(manifestStruct));
						}
					} else if (entry.id === RESOURCE_TYPE.RCDATA) {
						if (resources[10] instanceof Array)
							resources[10] = {};
						const resource = resources[10];
						for (const entry of lastEntry.directory?.entries ?? []) {
							const name = entry.name ?? `#${entry.id}`;
							const rcdata = entry.directory?.entries?.pop()?.data?.struct;
							if (rcdata)
								resource[name.toLowerCase()] = await fd.read(fd.RVA2Offset(rcdata.offsetToData), rcdata.size);
						}
					}
					else throw Error('not handled');
				}
			}
			return { struct: resourceDir, entries: dirEntries };
		}
		async function parseVersionInformation(resource: any, versionStruct: any) {
			let nullindex = 0, offset = 0;
			const startOffset = versionStruct.offsetToData;
			const rawData = await fd.read(fd.RVA2Offset(startOffset), versionStruct.size);
			getString(offset);	// skip VS_VERSION_INFO
			offset = alignDword(2 + nullindex, startOffset);
			const fixedFileInfo = {
				Signature: rawData.readUInt32LE(offset), StrucVersion: rawData.readUInt32LE(offset + 4), FileVersionMS: rawData.readUInt32LE(offset + 8), FileVersionLS: rawData.readUInt32LE(offset + 12), ProductVersionMS: rawData.readUInt32LE(offset + 16), ProductVersionLS: rawData.readUInt32LE(offset + 20), FileFlagsMask: rawData.readUInt32LE(offset + 24), FileFlags: rawData.readUInt32LE(offset + 28), FileOS: rawData.readUInt32LE(offset + 32), FileType: rawData.readUInt32LE(offset + 36), FileSubtype: rawData.readUInt32LE(offset + 40), FileDateMS: rawData.readUInt32LE(offset + 44), FileDateLS: rawData.readUInt32LE(offset + 48)
			}
			const fileInfo = { StringTable: [] as any[], Version: [fixedFileInfo.FileVersionMS >> 16, fixedFileInfo.FileVersionMS & 0xffff, fixedFileInfo.FileVersionLS >> 16, fixedFileInfo.FileVersionLS & 0xffff].join('.') };

			resource.push(fileInfo);
			offset = alignDword(offset + 52, startOffset);

			const stringFileInfo = getString(offset);
			if (stringFileInfo.Key === 'StringFileInfo' && [0, 1].includes(stringFileInfo.Type) && stringFileInfo.ValueLength === 0) {
				let stringTableOffset = alignDword(2 + nullindex, startOffset);
				while (true) {
					const stringTable = getString(stringTableOffset);
					const entries: any = {};
					fileInfo.StringTable.push(entries);
					offset = alignDword(2 + nullindex, startOffset);

					while (offset < stringTableOffset + stringTable.Length) {
						const entryOffset = offset;
						const key = getString(offset);
						offset = alignDword(2 + nullindex, startOffset);
						const value = getString(offset, false);
						if (key.Length === 0)
							offset = stringTableOffset + stringTable.Length
						else
							offset = alignDword(entryOffset + key.Length, startOffset);
						entries[key.Key] = value.Key;
					}
					offset = alignDword(stringTable.Length + stringTableOffset, startOffset);
					if (offset === stringTableOffset || offset >= stringFileInfo.Length)
						break;
					stringTableOffset = offset;
				}
			}
			function getString(offset: number, hasinfo = true) {
				let info: any = {};
				if (hasinfo)
					info = {
						Length: rawData.readUInt16LE(offset), ValueLength: rawData.readUInt16LE(offset + 2), Type: rawData.readUInt16LE(offset + 4)
					}, offset += 6;
				nullindex = ((rawData.indexOf(Buffer.alloc(2), offset) + 1) >> 1) * 2;
				return { ...info, Key: rawData.subarray(offset, nullindex).toString('utf16le') };
			}
		}
		async function parseUTF8String(dataStruct: any) { return (await fd.read(fd.RVA2Offset(dataStruct.offsetToData), dataStruct.size)).toString(); }
		function alignDword(offset: number, base: number) { return ((offset + base + 3) & 0xfffffffc) - (base & 0xfffffffc); }
	}
}

export function getFileVersion(path: string) {
	return new PEFile(path).getResource(RESOURCE_TYPE.VERSION);
}

export async function searchAndOpenPEFile(path: string, isBit64?: boolean): Promise<PEFile | undefined> {
	let pe: PEFile, file = '', dirs: string[] | undefined;
	const exts: string[] = [''];
	while (true) {
		try {
			if (!existsSync(path))
				throw Error();
			pe = new PEFile(path);
			const is_bit64 = await pe.is_bit64;
			if (file && isBit64 !== undefined && is_bit64 !== isBit64) {
				pe.close();
				throw Error();
			}
			return pe;
		} catch (e) {
			if (e instanceof Error || (e as any).errno === -4058) {
				if (!dirs) {
					if (path.includes(':') || !(dirs = process.env.Path?.split(';')))
						return undefined;
					if (isBit64 === false)
						dirs.unshift('C:\\Windows\\SysWOW64\\');
					file = path;
					if (!file.toLowerCase().endsWith('.dll'))
						exts.push('.dll');
				}
				let t: string | undefined;
				outloop:
				while (undefined !== (t = dirs.pop())) {
					for (const ext of exts)
						if (t && (existsSync(path = (t.endsWith('/') || t.endsWith('\\') ? t : t + '\\') + file + ext)))
							break outloop;
				}
				if (!t)
					return undefined;
			}
		}
	}
}