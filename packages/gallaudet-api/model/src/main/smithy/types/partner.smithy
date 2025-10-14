$version: "2"
namespace llc.civictech.school

/// Numeric Roblox identifier for the partner's primary experience.
@pattern("^[0-9]+$")
string RobloxGameId

/// Human-readable display name for the partner.
@length(min: 1, max: 120)
string PartnerName