import { Structure } from "./Structure";
import { PEFile } from "./PEFile";
import { Format } from "./Unpack";

const FORMAT: Format = [
    ["8s", "Name"],
    ["I", "Misc", "Misc_PhysicalAddress", "Misc_VirtualSize"],
    ["I", "VirtualAddress"],
    ["I", "SizeOfRawData"],
    ["I", "PointerToRawData"],
    ["I", "PointerToRelocations"],
    ["I", "PointerToLinenumbers"],
    ["H", "NumberOfRelocations"],
    ["H", "NumberOfLinenumbers"],
    ["I", "Characteristics"],
];

export class SectionStructure extends Structure {
    public Name = "";
    public Misc = 0;
    public Misc_PhysicalAddress = 0;
    public Misc_VirtualSize = 0;
    public VirtualAddress = 0;
    public SizeOfRawData = 0;
    public PointerToRawData = 0;
    public PointerToRelocations = 0;
    public PointerToLinenumbers = 0;
    public NumberOfRelocations = 0;
    public NumberOfLinenumbers = 0;
    public Characteristics = 0;
    public NextSectionVirtualAddress?: number;

    private readonly PE: PEFile;

    constructor(PE: PEFile, fileOffset = 0) {
        super(FORMAT, fileOffset);
        this.PE = PE;
    }

    public getData(start?: number, length?: number): Buffer {
        const pointerToRawDataAdjustment = this.PE.adjustFileAlignment(
            this.PointerToRawData,
            this.PE.OPTIONAL_HEADER.FileAlignment
        );
        const virtualAddressAdjustment = this.PE.adjustSectionAlignment(
            this.VirtualAddress,
            this.PE.OPTIONAL_HEADER.SectionAlignment,
            this.PE.OPTIONAL_HEADER.FileAlignment
        );

        let offset;
        let end;

        if (start === undefined) offset = pointerToRawDataAdjustment;
        else offset = start - virtualAddressAdjustment + pointerToRawDataAdjustment;

        if (length !== undefined) end = offset + length;
        else end = offset + this.SizeOfRawData;

        if (end > this.PointerToRawData + this.SizeOfRawData)
            end = this.PointerToRawData + this.SizeOfRawData;

        return this.PE.data.slice(offset, end);
    }

    public getRvaFromOffset(offset: number): number {
        return (
            offset -
            this.PE.adjustFileAlignment(
                this.PointerToRawData,
                this.PE.OPTIONAL_HEADER.FileAlignment
            ) +
            this.PE.adjustSectionAlignment(
                this.VirtualAddress,
                this.PE.OPTIONAL_HEADER.SectionAlignment,
                this.PE.OPTIONAL_HEADER.FileAlignment
            )
        );
    }

    public getOffsetFromRva(rva: number): number {
        return (
            rva -
            this.PE.adjustSectionAlignment(
                this.VirtualAddress,
                this.PE.OPTIONAL_HEADER.SectionAlignment,
                this.PE.OPTIONAL_HEADER.FileAlignment
            ) +
            this.PE.adjustFileAlignment(
                this.PointerToRawData,
                this.PE.OPTIONAL_HEADER.FileAlignment
            )
        );
    }

    public containsOffset(offset: number): boolean {
        if (this.PointerToRawData === undefined) return false;
        return (
            this.PE.adjustFileAlignment(
                this.PointerToRawData,
                this.PE.OPTIONAL_HEADER.FileAlignment
            ) <= offset &&
            offset <
                this.PE.adjustFileAlignment(
                    this.PointerToRawData,
                    this.PE.OPTIONAL_HEADER.FileAlignment
                ) +
                    this.SizeOfRawData
        );
    }

    public containsRva(rva: number): boolean {
        let size;

        if (
            this.PE.data.length -
                this.PE.adjustFileAlignment(
                    this.PointerToRawData,
                    this.PE.OPTIONAL_HEADER.FileAlignment
                ) <
            this.SizeOfRawData
        ) {
            size = this.Misc_VirtualSize;
        } else {
            size = Math.max(this.SizeOfRawData, this.Misc_VirtualSize);
        }

        const virtualAddressAdjustment = this.PE.adjustSectionAlignment(
            this.VirtualAddress,
            this.PE.OPTIONAL_HEADER.SectionAlignment,
            this.PE.OPTIONAL_HEADER.FileAlignment
        );

        if (
            this.NextSectionVirtualAddress !== undefined &&
            this.NextSectionVirtualAddress > this.VirtualAddress &&
            virtualAddressAdjustment + size > this.NextSectionVirtualAddress
        ) {
            size = this.NextSectionVirtualAddress - virtualAddressAdjustment;
        }

        return virtualAddressAdjustment <= rva && rva < virtualAddressAdjustment + size;
    }
}
