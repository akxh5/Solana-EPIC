export type AccountField = {
  name: string;
  type: string;
  byteSize: number | null;
  note?: string;
};

export type AccountStruct = {
  name: string;
  byteSize: number;
  byteSizeIncludesDiscriminator: true;
  fields: AccountField[];
  filePath: string;
};

export type AnalyzeResult = {
  projectPath: string;
  accounts: AccountStruct[];
};

export { analyzeAnchorProject } from "./project.js";
