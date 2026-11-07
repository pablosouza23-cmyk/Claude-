using UnrealBuildTool;

public class UltimateBattleRoyaleEditorTarget : TargetRules
{
	public UltimateBattleRoyaleEditorTarget(TargetInfo Target) : base(Target)
	{
		Type = TargetType.Editor;
		DefaultBuildSettings = BuildSettingsVersion.V5;
		IncludeOrderVersion = EngineIncludeOrderVersion.Unreal5_4;
		ExtraModuleNames.Add("UltimateBattleRoyale");
	}
}
