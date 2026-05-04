/**
 * Parse layer re-exports — convenience surface for consumers that
 * import everything from `@0xhoneyjar/asset-pipeline`.
 *
 * The canonical home for parseImage is `@0xhoneyjar/freeside-protocol`
 * per SDD §10.3 (Risk 5 mitigation — protocol owns the URL_CONTRACT-bound
 * shape). We re-export here so consumers don't have to add a second
 * dependency for the helper.
 */

export {
  parseImage,
  decodeAndParseImage,
  type ParsedImage,
  MetadataImage,
  MetadataImageStruct,
  ImageCapability,
} from "@0xhoneyjar/freeside-protocol";
