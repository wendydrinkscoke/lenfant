$version: "2"
namespace llc.civictech.school

/// Identifier of the partner that registered the catalog entry.
/// 
/// This ID corresponds to the Roblox universe/experience identifier for the
/// partner integration.
@pattern("^[0-9]+$")
string PartnerId

/// Numeric Roblox identifier for the partner's primary experience.
@pattern("^[0-9]+$")
string RobloxGameId

/// A unique identifier for the Roblox experience/universe.
@pattern("^[0-9]+$")
string ExperienceId

/// CivicTech-generated identifier for an API key stored in our partner's
/// experience's secret store. Up to two API Gateway API keys could correspond
/// to a secret to support rotation. I'm not sure yet if having a separate
/// secret ID is preferable to just using the experience ID itself. So we
/// may remove this later. My thinking now though is that we may eventually
/// have the prod account communicate with the gamma account to get a gamma
/// API key but that's much longer term. In that long-term scenario, it'd 
/// help to have separate secret IDs.
@pattern("^[a-z]{12}$")
string SecretId

/// Human-readable display name for the partner.
@length(min: 1, max: 120)
string PartnerName
