import type {
  CommunityServiceSummary,
  InstalledSignalServiceSummary,
  OfficialProviderAdvisory,
  OfficialServiceStatus,
  StatusData,
} from "./types.js";

export function formatStatus(data: StatusData, serviceId?: string) {
  const serviceIds = getServiceIds(data, serviceId);

  if (serviceId && serviceIds.length === 0) {
    return `No status found for ${serviceId}.`;
  }

  const serviceBlocks = serviceIds
    .map((id) =>
      formatServiceStatus({
        serviceId: id,
        community: data.community.services.find((service) => service.serviceId === id),
        installedSignals: data.installedSignals?.services.find(
          (service) => service.serviceId === id,
        ),
        official: data.official?.services.find((service) => service.serviceId === id),
        installedSignalsAvailable: Boolean(data.installedSignals),
      }),
    )
    .join("\n\n");
  const displayedProviderIds = new Set(serviceIds.map(getProviderId));
  const providerAdvisories = (data.official?.providerAdvisories ?? []).filter(
    (advisory) => displayedProviderIds.has(advisory.providerId),
  );

  return [serviceBlocks, formatProviderAdvisories(providerAdvisories)]
    .filter(Boolean)
    .join("\n\n");
}

function getServiceIds(data: StatusData, serviceId?: string) {
  if (serviceId) {
    const exists =
      data.community.services.some((service) => service.serviceId === serviceId) ||
      data.installedSignals?.services.some(
        (service) => service.serviceId === serviceId,
      ) ||
      Boolean(data.official?.services.some((service) => service.serviceId === serviceId));

    return exists ? [serviceId] : [];
  }

  return data.community.services.map((service) => service.serviceId);
}

function formatServiceStatus(input: {
  serviceId: string;
  community: CommunityServiceSummary | undefined;
  installedSignals: InstalledSignalServiceSummary | undefined;
  official: OfficialServiceStatus | undefined;
  installedSignalsAvailable: boolean;
}) {
  const communityTotal = input.community?.total ?? 0;
  const installedTotal = input.installedSignals?.total ?? 0;
  const officialText = input.official
    ? `${formatValue(input.official.overall)} (${input.official.source})`
    : "unavailable";
  const lines = [
    input.serviceId,
    `Community reports: ${communityTotal}`,
    input.installedSignalsAvailable
      ? `Installed signals: ${installedTotal}`
      : "Installed signals: unavailable",
    input.installedSignalsAvailable
      ? `Unique installations: ${input.installedSignals?.uniqueInstallationsApprox ?? 0}`
      : "Unique installations: unavailable",
    `Official: ${officialText}`,
  ];

  if (input.installedSignals?.lastSignal) {
    lines.push(
      `Last installed signal: ${formatValue(input.installedSignals.lastSignal.symptom)}`,
    );
  }

  return lines.join("\n");
}

function formatProviderAdvisories(advisories: OfficialProviderAdvisory[]) {
  if (advisories.length === 0) return "";

  return [
    "Official provider advisories",
    ...advisories.map(
      (advisory) =>
        `${advisory.providerId}: ${advisory.name} (${formatValue(advisory.status)}, ${formatValue(advisory.impact)})`,
    ),
  ].join("\n");
}

function getProviderId(serviceId: string) {
  return serviceId.split("-")[0] ?? "unknown";
}

function formatValue(value: string) {
  return value.replaceAll("_", " ");
}
