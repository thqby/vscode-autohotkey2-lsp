import { PEFile } from "./PEFile";
import { Unpack } from "./Unpack";

export class UnicodeStringWrapperPostProcessor {
    private readonly PE: PEFile;
    private readonly rvaPointer: number;
    private str: string;

    constructor(PE: PEFile, rvaPointer: number) {
        this.PE = PE;
        this.rvaPointer = rvaPointer;
        this.str = "";
    }

    public getRva(): number {
        return this.rvaPointer;
    }

    public getPascal16Length(): number {
        return this.getWordValueAtRva();
    }

    public renderPascal16(): void {
        this.str = this.PE.getStringUAtRva(this.rvaPointer + 2, this.getPascal16Length());
    }

    private getWordValueAtRva() {
        const data = this.PE.getData(this.rvaPointer, 2);
        return Unpack.unpack("<H", data)[0];
    }
}
