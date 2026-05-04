// Re-exports for the parse layer.
// parseImage helper lives in @freeside-storage/protocol per SDD §10.3
// (Risk 5 mitigation — protocol package keeps the URL_CONTRACT-bound shape).
// Activated by T0-3 (protocol bump to 1.3.0 + parseImage helper).
export {};
