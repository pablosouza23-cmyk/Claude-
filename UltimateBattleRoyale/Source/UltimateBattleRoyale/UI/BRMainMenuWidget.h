#pragma once

#include "CoreMinimal.h"
#include "UI/BRBaseWidget.h"
#include "Core/BRTypes.h"
#include "BRMainMenuWidget.generated.h"

class UVerticalBox;
class UTextBlock;
class ABRLobbyScene;

// Front-end menu: Jogar, Modos, Personagem, Loja, Passe, Inventário, Amigos, Configurações.
// Every button is wired to a real system (sessions, progression, cosmetics, settings).
UCLASS()
class ULTIMATEBATTLEROYALE_API UBRMainMenuWidget : public UBRBaseWidget
{
	GENERATED_BODY()

protected:
	virtual void BuildLayout() override;
	virtual void NativeConstruct() override;
	virtual void NativeDestruct() override;

private:
	void ShowTab(int32 Tab);
	void RefreshHeader();
	void BuildPlay();
	void BuildModes();
	void BuildCharacter();
	void BuildShop();
	void BuildPass();
	void BuildInventory();
	void BuildFriends();
	void BuildSettings();
	void SetStatus(const FText& Text);
	ABRLobbyScene* GetLobby() const;

	UPROPERTY(Transient) TObjectPtr<UVerticalBox> Content;
	UPROPERTY(Transient) TObjectPtr<UTextBlock> HeaderText;
	UPROPERTY(Transient) TObjectPtr<UTextBlock> StatusText;

	int32 CurrentTab = 0;
	EBRGameModeType SelectedMode = EBRGameModeType::Solo;
	FDelegateHandle ProfileHandle, StatusHandle, FriendsHandle;
};
