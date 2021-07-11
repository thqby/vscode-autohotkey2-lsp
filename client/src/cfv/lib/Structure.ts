import { Format, Unpack } from "./Unpack";

export class Structure {
    protected fieldOffsets: Record<string, number>;
    protected keys: string[][];
    protected formatLength: number;
    protected fileOffset: number;
    protected format: string;

    constructor(format: Format, fileOffset = 0) {
        let offset = 0;

        this.keys = [];
        this.format = "<";
        this.fieldOffsets = {};

        for (let i = 0; i < format.length; i++) {
            const type = format[i][0];
            const names = format[i].slice(1);
            this.format += type;

            for (const name of names) {
                this.fieldOffsets[name] = offset;
            }

            this.keys.push(names);
            offset += Unpack.sizeofType(type);
        }

        this.fileOffset = fileOffset;
        this.formatLength = Unpack.sizeofFormat(this.format);
    }

    public unpack(data: Buffer): this {
        if (data.length > this.formatLength) {
            data = data.slice(0, this.formatLength);
        }

        const unpacked = Unpack.unpack(this.format, data);

        for (let i = 0; i < unpacked.length; i++)
            for (const key of this.keys[i]) this.setAttr(key, unpacked[i]);

        return this;
    }

    public getFieldAbsoluteOffset(fieldName: string): number {
        return this.fileOffset + this.fieldOffsets[fieldName];
    }

    public getFieldRelativeOffset(fieldName: string): number {
        return this.fieldOffsets[fieldName];
    }

    public setFileOffset(offset: number): void {
        this.fileOffset = offset;
    }

    public getFileOffset(): number {
        return this.fileOffset;
    }

    public getFormat(): string {
        return this.format;
    }

    public sizeof(): number {
        return this.formatLength;
    }

    private setAttr(key: string, data: unknown): void {
        // eslint-disable-next-line @typescript-eslint/ban-ts-comment
        // @ts-ignore
        this[key] = data;
    }
}
