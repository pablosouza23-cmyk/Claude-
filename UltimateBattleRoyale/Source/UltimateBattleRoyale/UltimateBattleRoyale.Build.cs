using UnrealBuildTool;

public class UltimateBattleRoyale : ModuleRules
{
	public UltimateBattleRoyale(ReadOnlyTargetRules Target) : base(Target)
	{
		PCHUsage = PCHUsageMode.UseExplicitOrSharedPCHs;

		PublicIncludePaths.Add(ModuleDirectory);

		PublicDependencyModuleNames.AddRange(new string[]
		{
			"Core", "CoreUObject", "Engine", "InputCore", "EnhancedInput",
			"NetCore", "PhysicsCore", "DeveloperSettings", "GameplayTags",
			"AIModule", "GameplayTasks", "NavigationSystem",
			"UMG", "Slate", "SlateCore",
			"Niagara", "AudioMixer",
			"ProceduralMeshComponent",
			"OnlineSubsystem", "OnlineSubsystemUtils",
			"Json", "JsonUtilities", "HTTP"
		});

		PrivateDependencyModuleNames.AddRange(new string[] { "ApplicationCore", "RenderCore", "RHI" });

		// Pure C++ gameplay rules (Rules/*.h) are shared with the standalone test suite in Tests/RulesTests.
		if (Target.Type == TargetType.Server)
		{
			PublicDefinitions.Add("BR_DEDICATED_SERVER_BUILD=1");
		}
		else
		{
			PublicDefinitions.Add("BR_DEDICATED_SERVER_BUILD=0");
		}
	}
}
