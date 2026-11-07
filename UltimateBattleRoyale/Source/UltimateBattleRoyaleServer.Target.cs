using UnrealBuildTool;

// Dedicated server target. Requires a source build of Unreal Engine 5.
public class UltimateBattleRoyaleServerTarget : TargetRules
{
	public UltimateBattleRoyaleServerTarget(TargetInfo Target) : base(Target)
	{
		Type = TargetType.Server;
		DefaultBuildSettings = BuildSettingsVersion.V5;
		IncludeOrderVersion = EngineIncludeOrderVersion.Unreal5_4;
		ExtraModuleNames.Add("UltimateBattleRoyale");
		bUseLoggingInShipping = true;
	}
}
