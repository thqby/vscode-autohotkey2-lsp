export type Format = string[][];

/* eslint-disable @typescript-eslint/no-explicit-any */
export class Unpack {
    private static readonly formatRegex = /(\d+)?([AxcbBhHsfdiIlLT])/g;
    private static readonly typeData: Record<string, number> = {
        A: 1,
        x: 1,
        c: 1,
        b: 1,
        B: 1,
        h: 2,
        H: 2,
        s: 1,
        f: 4,
        d: 8,
        T: 8,
        i: 4,
        I: 4,
        l: 4,
        L: 4,
    };

    public static unpack(format: string, data: Buffer, offset = 0): any[] {
        const isBigEndian = format.charAt(0) !== "<";
        const out = [];
        let match;

        while ((match = Unpack.formatRegex.exec(format))) {
            const length = match[1] === undefined || match[1] === "" ? 1 : parseInt(match[1]);
            const typeLength = Unpack.typeData[match[2]];

            if (offset + length * typeLength > data.length) return [];

            switch (match[2]) {
                case "A":
                    out.push(data.slice(offset, offset + length));
                    break;
                case "s":
                    let str = "";
                    for (let i = 0; i < length; i++) {
                        str += String.fromCharCode(data[offset + i]);
                    }
                    out.push(str);
                    break;
                case "c":
                    out.push(
                        Unpack.unpackSeries(
                            (data, offset) => String.fromCharCode(data[offset]),
                            data,
                            offset,
                            length,
                            typeLength
                        )
                    );
                    break;
                case "b":
                    out.push(
                        Unpack.unpackSeries(
                            Unpack.generateUnpackInt(isBigEndian, 1, true),
                            data,
                            offset,
                            length,
                            typeLength
                        )
                    );
                    break;
                case "B":
                    out.push(
                        Unpack.unpackSeries(
                            Unpack.generateUnpackInt(isBigEndian, 1, false),
                            data,
                            offset,
                            length,
                            typeLength
                        )
                    );
                    break;
                case "h":
                    out.push(
                        Unpack.unpackSeries(
                            Unpack.generateUnpackInt(isBigEndian, 2, true),
                            data,
                            offset,
                            length,
                            typeLength
                        )
                    );
                    break;
                case "H":
                    out.push(
                        Unpack.unpackSeries(
                            Unpack.generateUnpackInt(isBigEndian, 2, false),
                            data,
                            offset,
                            length,
                            typeLength
                        )
                    );
                    break;
                case "i":
                case "l":
                    out.push(
                        Unpack.unpackSeries(
                            Unpack.generateUnpackInt(isBigEndian, 4, true),
                            data,
                            offset,
                            length,
                            typeLength
                        )
                    );
                    break;
                case "I":
                case "L":
                    out.push(
                        Unpack.unpackSeries(
                            Unpack.generateUnpackInt(isBigEndian, 4, false),
                            data,
                            offset,
                            length,
                            typeLength
                        )
                    );
                    break;
                case "f":
                    out.push(
                        Unpack.unpackSeries(
                            Unpack.generateUnpack754(isBigEndian, 4, 23),
                            data,
                            offset,
                            length,
                            typeLength
                        )
                    );
                    break;
                case "d":
                    out.push(
                        Unpack.unpackSeries(
                            Unpack.generateUnpack754(isBigEndian, 8, 52),
                            data,
                            offset,
                            length,
                            typeLength
                        )
                    );
                    break;
                case "T":
                    out.push(
                        Unpack.unpackSeries(
                            Unpack.generateUnpackInt(isBigEndian, 8, false),
                            data,
                            offset,
                            length,
                            typeLength));
                    break;
            }

            offset += length * typeLength;
        }

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        return Array.prototype.concat.apply([], out);
    }

    public static sizeofType(type: string): number {
        const match = Unpack.formatRegex.exec(type);
        if (match === null) return 0;
        return (
            (match[1] === undefined || match[1] === "" ? 1 : parseInt(match[1])) *
            Unpack.typeData[match[2]]
        );
    }

    public static sizeofFormat(format: string): number {
        let sum = 0;
        let match;

        while ((match = Unpack.formatRegex.exec(format))) {
            sum +=
                (match[1] === undefined || match[1] === "" ? 1 : parseInt(match[1])) *
                Unpack.typeData[match[2]];
        }

        return sum;
    }

    private static generateUnpackInt(
        isBigEndian: boolean,
        length: number,
        bSigned: boolean
    ): (data: Buffer, off: number) => number {
        return (data: Buffer, offset: number) => {
            const lsb = isBigEndian ? length - 1 : 0;
            const nsb = isBigEndian ? -1 : 1;
            const stop = lsb + nsb * length;

            let multiplier = 1;
            let out = 0;

            for (let i = lsb; i != stop; i += nsb) {
                out += data[offset + i] * multiplier;
                multiplier *= 256;
            }

            if (bSigned && out & Math.pow(2, length * 8 - 1)) {
                out -= Math.pow(2, length * 8);
            }

            return out;
        };
    }

    private static generateUnpack754(
        isBigEndian: boolean,
        length: number,
        maxLength: number
    ): (data: Buffer, offset: number) => number {
        return (data: Buffer, offset: number) => {
            const mLen = length;
            const eLen = length * 8 - maxLength - 1;
            const eMax = (1 << eLen) - 1;
            const eBias = eMax >> 1;
            const d = isBigEndian ? 1 : -1;

            let e, m;
            let nBits = -7;
            let i = (isBigEndian ? 0 : length - 1) + d;
            let s = data[offset + i];

            // noinspection DuplicatedCode, StatementWithEmptyBodyJS
            for (
                e = s & ((1 << -nBits) - 1), s >>= -nBits, nBits += eLen;
                nBits > 0;
                e = e * 256 + data[offset + i], i += d, nBits -= 8
            );
            // noinspection DuplicatedCode, StatementWithEmptyBodyJS
            for (
                m = e & ((1 << -nBits) - 1), e >>= -nBits, nBits += mLen;
                nBits > 0;
                m = m * 256 + data[offset + i], i += d, nBits -= 8
            );

            switch (e) {
                case 0:
                    // Zero, or denormalized number
                    e = 1 - eBias;
                    break;
                case eMax:
                    // NaN, or +/-Infinity
                    return m ? NaN : (s ? -1 : 1) * Infinity;
                default:
                    // Normalized number
                    m = m + Math.pow(2, mLen);
                    e = e - eBias;
                    break;
            }
            return (s ? -1 : 1) * m * Math.pow(2, e - mLen);
        };
    }

    private static unpackSeries(
        func: (data: Buffer, offset: number) => any,
        data: Buffer,
        offset: number,
        length: number,
        typeLength: number
    ) {
        const out = [];

        for (let i = 0; i < length; i++) {
            out.push(func(data, offset + i * typeLength));
        }

        return out;
    }
}
