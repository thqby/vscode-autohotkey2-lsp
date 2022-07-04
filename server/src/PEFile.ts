import { openSync, readSync, closeSync, existsSync } from 'fs';

export enum DIRECTORY_ENTRY {
	IMAGE_DIRECTORY_ENTRY_EXPORT = 0, IMAGE_DIRECTORY_ENTRY_IMPORT = 1, IMAGE_DIRECTORY_ENTRY_RESOURCE = 2, IMAGE_DIRECTORY_ENTRY_EXCEPTION = 3, IMAGE_DIRECTORY_ENTRY_SECURITY = 4, IMAGE_DIRECTORY_ENTRY_BASERELOC = 5, IMAGE_DIRECTORY_ENTRY_DEBUG = 6, IMAGE_DIRECTORY_ENTRY_COPYRIGHT = 7, IMAGE_DIRECTORY_ENTRY_GLOBALPTR = 8, IMAGE_DIRECTORY_ENTRY_TLS = 9, IMAGE_DIRECTORY_ENTRY_LOAD_CONFIG = 10, IMAGE_DIRECTORY_ENTRY_BOUND_IMPORT = 11, IMAGE_DIRECTORY_ENTRY_IAT = 12, IMAGE_DIRECTORY_ENTRY_DELAY_IMPORT = 13, IMAGE_DIRECTORY_ENTRY_COM_DESCRIPTOR = 14, IMAGE_DIRECTORY_ENTRY_RESERVED = 15
}
export enum RESOURCE_TYPE {
	CURSOR = 1, BITMAP = 2, ICON = 3, MENU = 4, DIALOG = 5, STRING = 6, FONTDIR = 7, FONT = 8, ACCELERATOR = 9, RCDATA = 10, MESSAGETABLE = 11, GROUP_CURSOR = 12, GROUP_ICON = 14, VERSION = 16, DLGINCLUDE = 17, PLUGPLAY = 19, VXD = 20, ANICURSOR = 21, ANIICON = 22, HTML = 23, MANIFEST = 24
}

export class PEFile {
	public isBit64 = false;
	public resource: { [key: number]: any } = {};
	private imageData: Buffer;
	private directoryEntry: { addr: number, size: number, data?: any }[] = [];
	constructor(path: string) {
		let sizeOfSectionHdr = 40;
		let buf = Buffer.alloc(8), fd = openSync(path, 'r');
		let ntHeadersOffset = readUInt(60);
		if (readUShort() !== 0x5a4d) {
			closeSync(fd);
			throw Error('no MS-DOS stub');
		}
		if (readUInt(ntHeadersOffset) !== 0x4550) {
			closeSync(fd);
			throw Error('no PE file');
		}
		let sizeOfOptionalHeader = readUShort(ntHeadersOffset + 20);
		let optionalHeaderOffset = ntHeadersOffset + 24, sectionsOffset = optionalHeaderOffset + sizeOfOptionalHeader;
		this.isBit64 = readShort(optionalHeaderOffset) === 0x20b;
		let numberOfRvaAndSize = readUInt(optionalHeaderOffset + (this.isBit64 ? 108 : 92));
		let numberOfSections = readUShort(ntHeadersOffset + 6);
		let sizeOfImage = readUInt(optionalHeaderOffset + 56);
		let dataDirectoryOffset = optionalHeaderOffset + (this.isBit64 ? 112 : 96);
		let offset = 0, rawBytes = Buffer.alloc(sizeOfSectionHdr * numberOfSections)
		readSync(fd, rawBytes, 0, rawBytes.length, optionalHeaderOffset + sizeOfOptionalHeader);
		this.imageData = Buffer.alloc(sizeOfImage);
		for (let i = 0; i < numberOfSections; i++) {
			let virtualAddress = rawBytes.readUInt32LE(offset + 12), sizeOfRawData = rawBytes.readUInt32LE(offset + 16), pointerToRawData = rawBytes.readUInt32LE(offset + 20);
			readSync(fd, this.imageData, virtualAddress, sizeOfRawData, pointerToRawData), offset += 40;
		}
		for (let i = 0; i < numberOfRvaAndSize; i++) {
			readSync(fd, buf, 0, 8, dataDirectoryOffset + 8 * i);
			this.directoryEntry.push({ addr: buf.readUInt32LE(0), size: buf.readUInt32LE(4) });
		}
		closeSync(fd);

		function readUShort(pos = 0) { return readSync(fd, buf, 0, 2, pos), buf.readUInt16LE(0); }
		function readShort(pos = 0) { return readSync(fd, buf, 0, 2, pos), buf.readInt16LE(0); }
		function readUInt(pos = 0) { return readSync(fd, buf, 0, 4, pos), buf.readUInt32LE(0); }
	}

	private getAscii(offset: number): string {
		return this.imageData.slice(offset, this.imageData.indexOf(Buffer.alloc(1), offset)).toString('ascii');
	}
	getExport(): { Module: string, Functions: { Name: string, EntryPoint: string, Ordinal: number }[], OrdinalBase: number } | undefined {
		const imageData = this.imageData, resinfo = this.directoryEntry[DIRECTORY_ENTRY.IMAGE_DIRECTORY_ENTRY_EXPORT];
		if (!resinfo?.addr)
			return;
		if (resinfo.data)
			return resinfo.data;
		const baseRva = resinfo.addr, endOfSection = baseRva + resinfo.size;
		let modNamePtr = imageData.readUInt32LE(baseRva + 0x0c);
		let OrdinalBase = imageData.readUInt32LE(baseRva + 0x10);
		let funcCount = imageData.readUInt32LE(baseRva + 0x14);
		let nameCount = imageData.readUInt32LE(baseRva + 0x18);
		let funcTblPtr = imageData.readUInt32LE(baseRva + 0x1c);
		let nameTblPtr = imageData.readUInt32LE(baseRva + 0x20);
		let ordTblPtr = imageData.readUInt32LE(baseRva + 0x24);
		const Exports = { Module: this.getAscii(modNamePtr), Functions: [] as any[], OrdinalBase }, ordinalList: { [ord: number]: boolean } = {};
		for (let i = 0; i < nameCount; i++) {
			let nameOffset = imageData.readUInt32LE(nameTblPtr), ordinal = imageData.readUInt16LE(ordTblPtr), fnOffset = imageData.readUInt32LE(funcTblPtr + ordinal * 4);
			nameTblPtr += 4, ordTblPtr += 2, ordinalList[ordinal] = true;
			let EntryPoint = fnOffset > baseRva && fnOffset < endOfSection ? this.getAscii(fnOffset) : '0x' + (fnOffset + 0x100000000).toString(16).substring(1);
			Exports.Functions.push({ Name: this.getAscii(nameOffset), EntryPoint, Ordinal: OrdinalBase + ordinal });
		}
		for (let ordinal = 0; nameCount < funcCount; ordinal++, nameCount++) {
			while (ordinalList[ordinal]) ordinal++;
			let fnOffset = imageData.readUInt32LE(funcTblPtr + ordinal * 4);
			let EntryPoint = fnOffset > baseRva && fnOffset < endOfSection ? this.getAscii(fnOffset) : '0x' + (fnOffset + 0x100000000).toString(16).substring(1);
			ordinalList[ordinal] = true, Exports.Functions.splice(ordinal, 0, { Name: '', EntryPoint, Ordinal: OrdinalBase + ordinal });
		}
		return resinfo.data = Exports;
	}
	getImport() {
		const imageData = this.imageData, resinfo = this.directoryEntry[DIRECTORY_ENTRY.IMAGE_DIRECTORY_ENTRY_IMPORT];
		if (!resinfo?.addr)
			return;
		if (resinfo.data)
			return resinfo.data;
		const baseRva = resinfo.addr;
		let nameOffset = imageData.readInt32LE(baseRva + 0x0c), firstThunk = imageData.readInt32LE(baseRva + 0x10);
		let ptrsize = 4, offset = baseRva, readPtr, ffff: any, IMAGE_ORDINAL_FLAG: any;
		if (this.isBit64)
			ptrsize = 8, ffff = BigInt(0xffff), IMAGE_ORDINAL_FLAG = BigInt('0x8000000000000000'), readPtr = imageData.readBigUInt64LE.bind(imageData);
		else ffff = 0xffff, IMAGE_ORDINAL_FLAG = 0x80000000, readPtr = imageData.readUInt32LE.bind(imageData);
		const Imports: { [dll: string]: string[] } = {};
		while (firstThunk) {
			let dllname = this.getAscii(nameOffset), arr = Imports[dllname] = [] as string[], ordinal: any;
			for (let i = 0; ordinal = readPtr(firstThunk + i * ptrsize); i++)
				arr.push(ordinal & IMAGE_ORDINAL_FLAG ? `Ordinal#${ordinal & ffff}` : this.getAscii(Number(ordinal) + 2));
			offset += 20;
			nameOffset = imageData.readUInt32LE(offset + 0x0c);
			firstThunk = imageData.readUInt32LE(offset + 0x10);
		}
		return resinfo.data = Imports;
	}
	getResource(...types: RESOURCE_TYPE[]): any {
		const imageData = this.imageData, resinfo = this.directoryEntry[DIRECTORY_ENTRY.IMAGE_DIRECTORY_ENTRY_RESOURCE];
		if (!resinfo?.addr)
			return;
		const baseRva = resinfo.addr, dirs = [baseRva], resources: any = {};
		if (types.length === 1 && this.resource[types[0]])
			return this.resource[types[0]];
		for (let type of types)
			if (!this.resource[type])
				resources[type] = this.resource[type] = [];
		parseResourcesDirectory(baseRva);
		for (let type of types)
			if (!resources[type])
				resources[type] = this.resource[type];
		return types.length === 1 ? resources[types[0]] : resources;

		function parseResourcesDirectory(rva: number, level = 0): any {
			const resourceDir = {
				// Characteristics: imageData.readUInt32LE(rva),	
				// TimeDateStamp: imageData.readUInt32LE(rva + 4),	
				// MajorVersion: imageData.readUInt16LE(rva + 8),		
				// MinorVersion: imageData.readUInt16LE(rva + 10),		
				NumberOfNamedEntries: imageData.readUInt16LE(rva + 12),
				NumberOfIdEntries: imageData.readUInt16LE(rva + 14)
			};
			const dirEntries = [], numberOfEntries = resourceDir.NumberOfIdEntries + resourceDir.NumberOfNamedEntries;
			rva += 16
			for (let i = 0; i < numberOfEntries; i++, rva += 8) {
				let name = imageData.readUInt32LE(rva), offsetToData = imageData.readUInt32LE(rva + 4), entryName, entryId;
				let entry = {
					name, id: name & 0x0000ffff, pad: name & 0xffff0000, nameOffset: name & 0x7fffffff, offsetToData: offsetToData, dataIsDirectory: Boolean((offsetToData & 0x80000000) >> 31), offsetToDirectory: offsetToData & 0x7fffffff
				};
				if (level === 0 && !resources[entry.id])
					continue;
				const nameIsString = Boolean((name & 0x80000000) >> 31);
				if (nameIsString) {
					const offset = baseRva + entry.nameOffset, length = imageData.readUInt16LE(offset);
					entryName = imageData.slice(offset + 2, length * 2 + offset + 2).toString('utf16le');
				} else
					entryId = name;
				if (entry.dataIsDirectory) {
					if (dirs.includes(baseRva + entry.offsetToDirectory))
						break;
					dirs.push(baseRva + entry.offsetToDirectory);
					let entryDirectory = parseResourcesDirectory(baseRva + entry.offsetToDirectory, level + 1);
					if (entryDirectory === undefined)
						break;
					dirEntries.push({ struct: entry, id: entryId, name: entryName, directory: entryDirectory });
				} else {
					let rva = baseRva + entry.offsetToDirectory;
					let struct = {
						offsetToData: imageData.readUInt32LE(rva), size: imageData.readUInt32LE(rva + 4), codePage: imageData.readUInt32LE(rva + 8), reserved: imageData.readUInt32LE(rva + 12)
					};
					let entryData = {
						struct: struct, lang: entry.name & 0x3ff, subLang: entry.name >> 10
					}
					dirEntries.push({ struct: entry, id: entryId, name: entryName, data: entryData });
				}
				if (level === 0) {
					if (entry.id === 16) {
						const lastEntry = dirEntries[dirEntries.length - 1];
						const versionEntries = lastEntry.directory?.entries[0].directory?.entries ?? [];
						for (const versionEntry of versionEntries) {
							const rtVersionStruct = versionEntry.data?.struct;
							if (rtVersionStruct)
								parseVersionInformation(resources[16], rtVersionStruct);
						}
					}
				}
			}
			return { struct: resourceDir, entries: dirEntries };
		}
		function parseVersionInformation(resource: any, versionStruct: any) {
			let nullindex = 0, offset = 0, startOffset = versionStruct.offsetToData;
			const rawData = imageData.slice(startOffset, startOffset + versionStruct.size);
			let versionInfo = getString(offset);
			offset = alignDword(2 + nullindex, startOffset);
			const fixedFileInfo = {
				Signature: rawData.readUInt32LE(offset), StrucVersion: rawData.readUInt32LE(offset + 4), FileVersionMS: rawData.readUInt32LE(offset + 8), FileVersionLS: rawData.readUInt32LE(offset + 12), ProductVersionMS: rawData.readUInt32LE(offset + 16), ProductVersionLS: rawData.readUInt32LE(offset + 20), FileFlagsMask: rawData.readUInt32LE(offset + 24), FileFlags: rawData.readUInt32LE(offset + 28), FileOS: rawData.readUInt32LE(offset + 32), FileType: rawData.readUInt32LE(offset + 36), FileSubtype: rawData.readUInt32LE(offset + 40), FileDateMS: rawData.readUInt32LE(offset + 44), FileDateLS: rawData.readUInt32LE(offset + 48)
			}
			const fileInfo = { StringTable: [] as any[], Version: [fixedFileInfo.FileVersionMS >> 16, fixedFileInfo.FileVersionMS & 0xffff, fixedFileInfo.FileVersionLS >> 16, fixedFileInfo.FileVersionLS & 0xffff].join('.') };

			resource.push(fileInfo);
			offset = alignDword(offset + 52, startOffset);

			let stringFileInfo = getString(offset);
			if (stringFileInfo.Key === 'StringFileInfo' && [0, 1].includes(stringFileInfo.Type) && stringFileInfo.ValueLength === 0) {
				let stringTableOffset = alignDword(2 + nullindex, startOffset);
				while (true) {
					const stringTable = getString(stringTableOffset);
					const entries: any = {};
					fileInfo.StringTable.push(entries);
					offset = alignDword(2 + nullindex, startOffset);

					while (offset < stringTableOffset + stringTable.Length) {
						let entryOffset = offset;
						let key = getString(offset);
						offset = alignDword(2 + nullindex, startOffset);
						let value = getString(offset, false);
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
				return { ...info, Key: rawData.slice(offset, nullindex).toString('utf16le') };
			}
		}
		function alignDword(offset: number, base: number) { return ((offset + base + 3) & 0xfffffffc) - (base & 0xfffffffc); }
	}
}

export function getFileVersion(path: string) {
	return new PEFile(path).getResource(RESOURCE_TYPE.VERSION);
}

export function searchAndOpenPEFile(path: string, isBit64?: boolean): PEFile | undefined {
	let pe: PEFile, file = '', dirs: string[] | undefined, exts: string[] = [''];
	while (true)
		try {
			pe = new PEFile(path);
			if (file && (typeof isBit64 === 'boolean') && pe.isBit64 !== isBit64)
				throw Error();
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
					for (let ext of exts)
						if (t && (existsSync(path = (t.endsWith('/') || t.endsWith('\\') ? t : t + '\\') + file + ext)))
							break outloop;
				}
				if (!t)
					return undefined;
			}
		}
}