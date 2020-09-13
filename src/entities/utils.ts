export const stringToDecimalBytes = (str: string) =>
  str.split('')
    .map((_, i) => str.charCodeAt(i))
    .join(' ');

export const decimalToHex = (dec: number) => {
  let hex = dec.toString(16);

  if (hex.length === 1) hex = 0 + hex;

  return hex;
};

export const getChecksum = (str: string) => {
  const newStr = str.toUpperCase();

  const strHex = "0123456789ABCDEF";
  let result = 0;
  let fctr = 16;

  for (let i = 0; i < newStr.length; i++) {
    if (newStr.charAt(i) === " " || newStr.charAt(i) === ",") continue;

    const curr = strHex.indexOf(newStr.charAt(i));
    if (curr < 0) {
      throw new Error("Non-hex character");
    }
    result += curr * fctr;

    if (fctr == 16) fctr = 1;
    else fctr = 16;
  }

  // Calculate 2's complement
  result = (~(result & 0xff) + 1) & 0xFF;
  return strHex.charAt(Math.floor(result / 16)) + strHex.charAt(result % 16);
};

export const createBuffer = (buffer: number[]) => {
  const checkSum = parseInt(getChecksum(buffer.map(item => decimalToHex(item)).join('')), 16);

  return Buffer.from([...buffer, checkSum]);
};
