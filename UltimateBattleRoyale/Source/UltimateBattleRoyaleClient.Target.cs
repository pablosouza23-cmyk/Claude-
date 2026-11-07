using UnrealBuildTool;

// Client-only target (no server code paths compiled in) for store builds.
public class UltimateBattleRoyaleClientTarget : TargetRules
{
	public UltimateBattleRoyaleClientTarget(TargetInfo Target) : base(Target)
	{
		Type = TargetType.Client;
		DefaultBuildSettings = BuildSettingsVersion.V5;
		IncludeOrderVersion = EngineIncludeOrderVersion.Unreal5_4;
		ExtraModuleNames.Add("UltimateBattleRoyale");
	}
}
