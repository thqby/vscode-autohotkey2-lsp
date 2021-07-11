import {
    DataDirectory,
    DIRECTORY_ENTRY,
    DosHeader,
    FileHeader,
    FixedFileInfo,
    NTHeader,
    OptionalHeader,
    RESOURCE_TYPE,
    ResourceDataEntry,
    ResourceDirectory,
    ResourceEntry,
    StringFileInfo,
    StringTable,
    StringTableEntry,
    VersionInfo,
} from "./structures";
import { ResourceDataEntryData, ResourceDirData, ResourceDirEntryData } from "./container";
import { UnicodeStringWrapperPostProcessor } from "./UnicodeStringWrapperPostProcessor";
import { SectionStructure } from "./SectionStructure";
import { Unpack } from "./Unpack";

const MAX_ASSUMED_VALID_NUMBER_OF_RVA_AND_SIZES = 0x100;
const MAX_SECTIONS = 0x800;

export class PEFile {
    public readonly data: Buffer;
    public readonly header: Buffer;

    public sections: SectionStructure[] = [];

    public DOS_HEADER: DosHeader;
    public NT_HEADER: NTHeader;
    public FILE_HEADER: FileHeader;
    public OPTIONAL_HEADER: OptionalHeader;

    public VS_VERSION_INFO: VersionInfo[] = [];
    public VS_FIXED_FILE_INFO: FixedFileInfo[] = [];
    public FILE_INFO: StringFileInfo[][] = [];

    constructor(data: Buffer) {
        this.data = data;

        this.DOS_HEADER = new DosHeader(0).unpack(data.slice(0, 64));
        const ntHeadersOffset = this.DOS_HEADER.e_lfanew;

        this.NT_HEADER = new NTHeader(ntHeadersOffset).unpack(
            data.slice(ntHeadersOffset, ntHeadersOffset + 8)
        );

        this.FILE_HEADER = new FileHeader(ntHeadersOffset + 4).unpack(
            data.slice(ntHeadersOffset + 4, ntHeadersOffset + 4 + 32)
        );

        const optionalHeaderOffset = ntHeadersOffset + 4 + this.FILE_HEADER.sizeof();
        const sectionsOffset = optionalHeaderOffset + this.FILE_HEADER.SizeOfOptionalHeader;
        const x64 = data[optionalHeaderOffset] === 0x0b && data[optionalHeaderOffset + 1] === 0x02;
        this.OPTIONAL_HEADER = new OptionalHeader(optionalHeaderOffset, x64).unpack(
            data.slice(optionalHeaderOffset, optionalHeaderOffset + 256)
        );

        this.NT_HEADER.FILE_HEADER = this.FILE_HEADER;
        this.NT_HEADER.OPTIONAL_HEADER = this.OPTIONAL_HEADER;

        let offset = optionalHeaderOffset + this.OPTIONAL_HEADER.sizeof();
        const emptyBuffer = Buffer.alloc(8);

        for (let i = 0; i < (0x7fffffff & this.OPTIONAL_HEADER.NumberOfRvaAndSizes); i++) {
            if (this.data.length - offset === 0) break;

            if (this.data.length - offset < 8) {
                data = Buffer.concat([this.data.slice(offset), emptyBuffer]);
            } else {
                data = this.data.slice(offset, offset + MAX_ASSUMED_VALID_NUMBER_OF_RVA_AND_SIZES);
            }

            const dirEntry = new DataDirectory(offset).unpack(data);
            dirEntry.name = Object.keys(DIRECTORY_ENTRY)[i];
            offset += dirEntry.sizeof();

            this.OPTIONAL_HEADER.DATA_DIRECTORY.push(dirEntry);
            if (offset >= optionalHeaderOffset + this.OPTIONAL_HEADER.sizeof() + 8 * 16) break;
        }

        offset = this.parseSections(sectionsOffset);

        const rawDataPointers = [];
        let lowestSectionOffset;

        for (const section of this.sections) {
            if (section.PointerToRawData > 0)
                rawDataPointers.push(
                    this.adjustFileAlignment(
                        section.PointerToRawData,
                        this.OPTIONAL_HEADER.FileAlignment
                    )
                );
        }

        if (rawDataPointers.length > 0) lowestSectionOffset = Math.min(...rawDataPointers);
        else lowestSectionOffset = undefined;

        if (lowestSectionOffset === undefined || lowestSectionOffset < offset)
            this.header = data.slice(0, offset);
        else this.header = data.slice(0, lowestSectionOffset);

        const resourceDir = this.OPTIONAL_HEADER.DATA_DIRECTORY[
            DIRECTORY_ENTRY["IMAGE_DIRECTORY_ENTRY_RESOURCE"]
        ];

        this.parseResourcesDirectory(resourceDir.VirtualAddress, resourceDir.Size);
    }

    public getSectionByRva(rva: number): SectionStructure | undefined {
        return this.sections.find((section) => section.containsRva(rva));
    }

    public getSectionByOffset(offset: number): SectionStructure | undefined {
        return this.sections.find((section) => section.containsOffset(offset));
    }

    // noinspection JSUnusedGlobalSymbols
    public getRvaFromOffset(offset: number): number | undefined {
        const section = this.getSectionByOffset(offset);

        if (section === undefined) {
            if (this.sections.length > 0) {
                const lowestRva = Math.min(
                    ...this.sections.map((section) =>
                        this.adjustSectionAlignment(
                            section.VirtualAddress,
                            this.OPTIONAL_HEADER.SectionAlignment,
                            this.OPTIONAL_HEADER.FileAlignment
                        )
                    )
                );

                if (offset < lowestRva) return offset;
                return undefined;
            }

            return offset;
        }

        return section.getRvaFromOffset(offset);
    }

    // noinspection JSUnusedGlobalSymbols
    public getOffsetFromRva(rva: number): number {
        const section = this.getSectionByRva(rva);

        if (section === undefined) {
            if (rva < this.data.length) return rva;
            throw new Error("Data at RVA can't be fetched. Corrupt header?");
        }

        return section.getOffsetFromRva(rva);
    }

    public getData(rva = 0, length?: number): Buffer {
        const section = this.getSectionByRva(rva);
        let end;

        if (length !== undefined) end = rva + length;

        if (section === undefined) {
            if (rva < this.header.length) return this.header.slice(rva, end);
            if (rva < this.data.length) return this.data.slice(rva, end);

            throw new Error("Data at RVA can't be fetched. Corrupt header?");
        }

        return section.getData(rva, length);
    }

    public getStringUAtRva(rva: number, maxLength = 2 ** 16, encoding?: BufferEncoding): string {
        maxLength <<= 1;

        let requested = Math.min(maxLength, 256);
        let data = this.getData(rva, requested);
        let dataLength = 0;
        let nullIndex = -1;

        while (true) {
            nullIndex = data.indexOf(Buffer.alloc(2), nullIndex + 1);
            if (nullIndex === -1) {
                dataLength = data.length;
                if (dataLength < requested || dataLength === maxLength) {
                    nullIndex = data.length >> 1;
                    break;
                } else {
                    data = Buffer.concat([
                        data,
                        this.getData(rva + dataLength, maxLength - dataLength),
                    ]);
                    nullIndex = requested - 1;
                    requested = maxLength;
                }
            } else if (nullIndex % 2 === 0) {
                nullIndex >>= 1;
                break;
            }
        }

        const raw = Unpack.unpack(`<${nullIndex}H`, data.slice(0, nullIndex * 2));
        const str = raw.map((chr) => String.fromCharCode(chr)).join("");

        if (encoding !== undefined) Buffer.from(str).toString(encoding);
        return Buffer.from(str).toString("utf8");
    }

    public adjustFileAlignment(value: number, fileAlignment: number): number {
        if (fileAlignment < 0x200) return value;
        return Math.round(value / 0x200) * 0x200;
    }

    public adjustSectionAlignment(
        value: number,
        sectionAlignment: number,
        fileAlignment: number
    ): number {
        if (sectionAlignment < 0x1000) sectionAlignment = fileAlignment;
        if (sectionAlignment && value % sectionAlignment)
            return sectionAlignment * Math.round(value / sectionAlignment);
        return value;
    }

    public alignDword(offset: number, base: number): number {
        return ((offset + base + 3) & 0xfffffffc) - (base & 0xfffffffc);
    }

    private parseSections(offset: number): number {
        for (let i = 0; i < this.FILE_HEADER.NumberOfSections; i++) {
            if (i >= MAX_SECTIONS) break;

            const section = new SectionStructure(this);
            const sectionOffset = offset + section.sizeof() * i;
            section.setFileOffset(sectionOffset);
            section.unpack(this.data.slice(sectionOffset, sectionOffset + section.sizeof()));

            this.sections.push(section);
        }

        this.sections.sort((a, b) => a.VirtualAddress - b.VirtualAddress);

        for (let i = 0; i < this.sections.length; i++) {
            if (i === this.sections.length - 1)
                this.sections[i].NextSectionVirtualAddress = undefined;
            else this.sections[i].NextSectionVirtualAddress = this.sections[i + 1].VirtualAddress;
        }

        if (this.FILE_HEADER.NumberOfSections > 0 && this.sections.length > 0)
            return offset + this.sections[0].sizeof() * this.FILE_HEADER.NumberOfSections;
        else return offset;
    }

    private parseResourcesDirectory(
        rva: number,
        length: number,
        baseRva?: number,
        level = 0,
        dirs?: number[]
    ): ResourceDirData {
        if (!dirs) dirs = [rva];
        if (!baseRva) baseRva = rva;

        const resourceDir = new ResourceDirectory(this.getOffsetFromRva(rva));
        resourceDir.unpack(this.getData(rva, resourceDir.sizeof()));

        const dirEntries: ResourceDirEntryData[] = [];
        const numberOfEntries = resourceDir.NumberOfNamedEntries + resourceDir.NumberOfIdEntries;
        rva += resourceDir.sizeof();

        const stringsToPostprocess: UnicodeStringWrapperPostProcessor[] = [];
        for (let i = 0; i < numberOfEntries; i++) {
            const entry = this.parseResourceEntry(rva);
            const nameIsString = Boolean((entry.Name & 0x80000000) >> 31);
            let entryName;
            let entryId;

            if (!nameIsString) entryId = entry.Name;
            else {
                const offset = baseRva + entry.NameOffset;
                entryName = new UnicodeStringWrapperPostProcessor(this, offset);
                stringsToPostprocess.push(entryName);
            }

            if (entry.DataIsDirectory) {
                if (dirs.includes(baseRva + entry.OffsetToDirectory)) break;
                const entryDirectory = this.parseResourcesDirectory(
                    baseRva + entry.OffsetToDirectory,
                    length - (rva - baseRva),
                    baseRva,
                    level + 1,
                    Array.prototype.concat([], dirs, baseRva + entry.OffsetToDirectory)
                );

                if (entryDirectory === undefined) break;

                dirEntries.push(
                    new ResourceDirEntryData(entry, entryName, entryId, entryDirectory)
                );
            } else {
                const struct = this.parseResourceDataEntry(baseRva + entry.OffsetToDirectory);
                const entryData = new ResourceDataEntryData(
                    struct,
                    entry.Name & 0x3ff,
                    entry.Name >> 10
                );

                dirEntries.push(new ResourceDirEntryData(entry, entryName, entryId, entryData));
            }

            if (level === 0 && entry.Id === RESOURCE_TYPE["RT_VERSION"]) {
                const lastEntry = dirEntries[dirEntries.length - 1];
                const versionEntries = lastEntry.directory?.entries[0].directory?.entries ?? [];

                for (const versionEntry of versionEntries) {
                    const rtVersionStruct = versionEntry.data?.struct;
                    if (rtVersionStruct) this.parseVersionInformation(rtVersionStruct);
                }
            }

            rva += entry.sizeof();
        }

        for (const str of stringsToPostprocess) {
            str.renderPascal16();
        }

        return new ResourceDirData(resourceDir, dirEntries);
    }

    private parseVersionInformation(versionStruct: ResourceDataEntry) {
        const startOffset = this.getOffsetFromRva(versionStruct.OffsetToData);
        const rawData = this.data.slice(startOffset, startOffset + versionStruct.Size);
        const versionInfo = new VersionInfo(startOffset).unpack(rawData);

        const offset = versionStruct.OffsetToData + versionInfo.sizeof();
        const section = this.getSectionByRva(offset);
        let sectionEnd;

        if (section !== undefined)
            sectionEnd =
                section.VirtualAddress + Math.max(section.SizeOfRawData, section.Misc_VirtualSize);

        let versionInfoString;

        if (sectionEnd === undefined)
            versionInfoString = this.getStringUAtRva(offset, 2 ** 16, "ascii");
        else versionInfoString = this.getStringUAtRva(offset, (sectionEnd - offset) >> 1, "ascii");

        const vInfo = versionInfo;
        vInfo.Key = versionInfoString;

        this.VS_VERSION_INFO.push(vInfo);

        const fixedFileInfoOffset = this.alignDword(
            versionInfo.sizeof() + 2 * (versionInfoString.length + 1),
            versionStruct.OffsetToData
        );
        const fixedFileInfo = new FixedFileInfo(startOffset + fixedFileInfoOffset).unpack(
            rawData.slice(fixedFileInfoOffset)
        );

        this.VS_FIXED_FILE_INFO.push(fixedFileInfo);

        const stringFileInfoOffset = this.alignDword(
            fixedFileInfoOffset + fixedFileInfo.sizeof(),
            versionStruct.OffsetToData
        );

        const fInfo: StringFileInfo[] = [];
        const stringFileInfo = new StringFileInfo(startOffset + stringFileInfoOffset).unpack(
            rawData.slice(stringFileInfoOffset)
        );

        const ustrOffset = versionStruct.OffsetToData + stringFileInfoOffset + versionInfo.sizeof();

        const stringFileInfoString = this.getStringUAtRva(ustrOffset);
        stringFileInfo.Key = stringFileInfoString;
        fInfo.push(stringFileInfo);

        if (stringFileInfoString.startsWith("StringFileInfo")) {
            if ([0, 1].includes(stringFileInfo.Type) && stringFileInfo.ValueLength === 0) {
                let stringTableOffset = this.alignDword(
                    stringFileInfoOffset +
                        stringFileInfo.sizeof() +
                        2 * (stringFileInfoString.length + 1),
                    versionStruct.OffsetToData
                );

                while (true) {
                    const stringTable = new StringTable(startOffset + stringTableOffset).unpack(
                        rawData.slice(stringTableOffset)
                    );

                    const ustrOffset =
                        versionStruct.OffsetToData + stringTableOffset + stringTable.sizeof();
                    const stringTableString = this.getStringUAtRva(ustrOffset);
                    stringTable.LangID = stringTableString;
                    stringFileInfo.StringTable.push(stringTable);

                    let entryOffset = this.alignDword(
                        stringTableOffset +
                            stringTable.sizeof() +
                            2 * (stringTableString.length + 1),
                        versionStruct.OffsetToData
                    );

                    while (entryOffset < stringTableOffset + stringTable.Length) {
                        const stringTableEntry = new StringTableEntry(
                            startOffset + entryOffset
                        ).unpack(rawData.slice(entryOffset));

                        let ustrOffset =
                            versionStruct.OffsetToData + entryOffset + stringTableEntry.sizeof();

                        const key = this.getStringUAtRva(ustrOffset);
                        const keyOffset = this.getOffsetFromRva(ustrOffset);
                        let valueOffset = this.alignDword(
                            2 * (key.length + 1) + entryOffset + stringTableEntry.sizeof(),
                            versionStruct.OffsetToData
                        );

                        ustrOffset = versionStruct.OffsetToData + valueOffset;
                        const value = this.getStringUAtRva(
                            ustrOffset,
                            stringTableEntry.ValueLength
                        );
                        valueOffset = this.getOffsetFromRva(ustrOffset);

                        if (stringTableEntry.Length === 0)
                            entryOffset = stringTableOffset + stringTable.Length;
                        else
                            entryOffset = this.alignDword(
                                stringTableEntry.Length + entryOffset,
                                versionStruct.OffsetToData
                            );

                        stringTable.entries[key] = value;
                        stringTable.entriesOffsets[key] = [keyOffset, valueOffset];
                        stringTable.entriesLengths[key] = [key.length, value.length];
                    }

                    const newStringTableOffset = this.alignDword(
                        stringTable.Length + stringTableOffset,
                        versionStruct.OffsetToData
                    );

                    if (newStringTableOffset === stringTableOffset) break;
                    stringTableOffset = newStringTableOffset;

                    if (stringTableOffset >= stringFileInfo.Length) break;
                }
            }
        }

        this.FILE_INFO.push(fInfo);
    }

    private parseResourceDataEntry(rva: number) {
        const dataEntry = new ResourceDataEntry(this.getOffsetFromRva(rva));
        dataEntry.unpack(this.getData(rva, dataEntry.sizeof()));

        return dataEntry;
    }

    private parseResourceEntry(rva: number) {
        const resource = new ResourceEntry(this.getOffsetFromRva(rva));
        resource.unpack(this.getData(rva, resource.sizeof()));

        resource.NameOffset = resource.Name & 0x7fffffff;
        resource.pad = resource.Name & 0xffff0000;
        resource.Id = resource.Name & 0x0000ffff;

        resource.DataIsDirectory = Boolean((resource.OffsetToData & 0x80000000) >> 31);
        resource.OffsetToDirectory = resource.OffsetToData & 0x7fffffff;

        return resource;
    }
}
