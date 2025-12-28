import dotenv from "dotenv";

dotenv.config({quiet : true});

export const envConfig = {
  codrel: {
    token: process.env.CODREL_TOKEN,
    pick: process.env.CODREL_PICK ? Number(process.env.CODREL_PICK) : 5,
  }
} as const;
