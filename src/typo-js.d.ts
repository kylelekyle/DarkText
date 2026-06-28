declare module "typo-js" {
  export default class Typo {
    constructor(
      locale: string,
      affData?: string,
      dicData?: string,
      platform?: string,
    );
    check(word: string): boolean;
    suggest(word: string): string[];
  }
}

declare module "typo-js/dictionaries/en_US/en_US.aff?raw" {
  const content: string;
  export default content;
}

declare module "typo-js/dictionaries/en_US/en_US.dic?raw" {
  const content: string;
  export default content;
}