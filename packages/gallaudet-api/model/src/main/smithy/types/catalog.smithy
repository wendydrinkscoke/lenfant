$version: "2"
namespace llc.civictech.school

/// Identifier of the partner (game studio) that registered the catalog entry.
@length(min: 1, max: 64)
string PartnerId

/// Identifier of the catalog entry within the partner's namespace.
@length(min: 1, max: 128)
string CatalogEntryId
