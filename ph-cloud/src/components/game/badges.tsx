import { Icon, type IconName } from "@/components/ui/Icon";
import { DEVICE_LABELS, GENRES, INPUT_LABELS, isLaunchable, type Device, type GameRecord, type InputMethod } from "@/modules/catalog/types";

const INPUT_ICONS: Record<InputMethod, IconName> = { touch: "touch", keyboard: "keyboard", mouse: "mouse", gamepad: "gamepad" };
const DEVICE_ICONS: Record<Device, IconName> = { mobile: "phone", tablet: "tablet", desktop: "monitor" };

export function InputIcons({ inputs, size = 16, className = "" }: { inputs: InputMethod[]; size?: number; className?: string }) {
  return (
    <span className={`inline-flex items-center gap-1.5 text-muted ${className}`} aria-label={`Entradas: ${inputs.map((i) => INPUT_LABELS[i]).join(", ")}`}>
      {inputs.map((i) => (
        <span key={i} title={INPUT_LABELS[i]}>
          <Icon name={INPUT_ICONS[i]} size={size} />
        </span>
      ))}
    </span>
  );
}

export function InputList({ inputs }: { inputs: InputMethod[] }) {
  return (
    <ul className="flex flex-wrap gap-2">
      {inputs.map((i) => (
        <li key={i} className="chip">
          <Icon name={INPUT_ICONS[i]} size={14} />
          {INPUT_LABELS[i]}
        </li>
      ))}
    </ul>
  );
}

export function DeviceList({ devices }: { devices: Device[] }) {
  return (
    <ul className="flex flex-wrap gap-2">
      {devices.map((d) => (
        <li key={d} className="chip">
          <Icon name={DEVICE_ICONS[d]} size={14} />
          {DEVICE_LABELS[d]}
        </li>
      ))}
    </ul>
  );
}

export function GenreText({ game }: { game: Pick<GameRecord, "genres"> }) {
  return <>{game.genres.map((g) => GENRES[g]).join(" · ")}</>;
}

export function AvailabilityBadge({ game }: { game: Pick<GameRecord, "availability" | "launch" | "enabled" | "streams"> }) {
  if (isLaunchable(game)) {
    if (game.launch.type === "official_streaming") {
      return (
        <span className="chip chip-accent">
          <Icon name="cloud" size={12} />
          Na nuvem
        </span>
      );
    }
    if (game.launch.type === "external_provider") {
      return (
        <span className="chip">
          <Icon name="external" size={12} />
          No site do provedor
        </span>
      );
    }
    return (
      <span className="chip chip-accent">
        <span className="h-1.5 w-1.5 rounded-full bg-accent" />
        Disponível
      </span>
    );
  }
  const labels = { coming_soon: "Em breve", maintenance: "Em manutenção", unavailable: "Indisponível", available: "Indisponível" } as const;
  return <span className="chip chip-warning">{labels[game.availability]}</span>;
}

export function AccessBadge({ game }: { game: Pick<GameRecord, "access"> }) {
  if (game.access !== "premium") return null;
  return (
    <span className="chip chip-warning">
      <Icon name="star" size={12} />
      Premium
    </span>
  );
}
