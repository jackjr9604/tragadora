export function isNonTranslatableExactField(fieldName:string){return/(^|_)(slug|code|id|brand|product_name)($|_)/i.test(fieldName)}
