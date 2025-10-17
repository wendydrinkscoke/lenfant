$version: "2"
namespace llc.civictech.school

/// Identifier of the catalog entry within the partner's namespace.
@length(min: 10, max: 50)
@pattern("^[a-z0-9-]+$")
string CatalogEntryId

/// A short, human-readable display name for the task.
@length(min: 10, max: 30)
string CatalogTaskName

/// A brief description displayed alongside the task title.
@length(min: 10, max: 60)
string CatalogTaskSubheading

/// Detailed instructions shown to teachers and students.
@length(min: 1)
string CatalogTaskInstructions
