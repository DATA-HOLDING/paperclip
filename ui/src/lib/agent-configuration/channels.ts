import type { AgentConfigurationDocument } from "@paperclipai/shared";
import { chatEndpointsApi } from "../../api/chatEndpoints";
import { equal, type AgentConfigurationSnapshot } from "./load";
import { requireItem, requireExplicitFields, unique, type AddConfigurationStep } from "./steps";
import { t } from "@/i18n";

export function planChannelChanges(snapshot: AgentConfigurationSnapshot, document: AgentConfigurationDocument, add: AddConfigurationStep) {
  const { id: agentId, companyId } = snapshot.agent;
  const before = snapshot.document.spec.channels!;
  const next = document.spec.channels;
  if (next) {
    unique(next.map(row => row.id), "channels");
    for (const row of next) {
      const previous = requireItem(before, channel => channel.id === row.id, t("libAgentConfiguration.labels.channel", { id: row.id }));
      if (row.provider !== previous.provider) throw new Error(t("libAgentConfiguration.channels.providerImmutable"));
      unique(row.resources.map(resource => resource.id), `channels.${row.id}.resources`);
      for (const resource of row.resources) {
        const existing = requireItem(previous.resources, value => value.id === resource.id, t("libAgentConfiguration.labels.channelResource", { id: resource.id }));
        requireExplicitFields(existing, resource, `channels.${row.id}.resources.${resource.id}`);
      }
      if (!equal(previous.settings, row.settings)) {
        requireExplicitFields(previous.settings, row.settings, `channels.${row.id}.settings`);
        const changes = Object.fromEntries(Object.entries(row.settings).filter(([key, value]) =>
          !equal(value, previous.settings[key as keyof typeof previous.settings])));
        add(t("libAgentConfiguration.channels.steps.settings", { id: row.id }), () => chatEndpointsApi.update(row.id, changes));
      }
      const resources = previous.resources.map(resource => row.resources.find(value => value.id === resource.id) ?? { ...resource, enabled: false });
      if (!equal(previous.resources, resources)) {
        add(t("libAgentConfiguration.channels.steps.resources", { id: row.id }), () => chatEndpointsApi.updateResources(row.id, resources));
      }
    }
    for (const previous of before) if (!next.some(row => row.id === previous.id)) {
      add(t("libAgentConfiguration.channels.steps.remove", { id: previous.id }), () => chatEndpointsApi.setup(previous.id, { action: "remove" }));
    }
  }
  const operations = document.spec.channelOperations;
  if (!operations) return;
  unique(operations.setup.map(row => row.id), "channelOperations.setup");
  for (const input of operations.create) add(t("libAgentConfiguration.channels.steps.create", { provider: input.provider }), () => chatEndpointsApi.create(companyId, { ...input, assignedAgentId: agentId }));
  for (const operation of operations.setup) {
    const previous = requireItem(before, channel => channel.id === operation.id, t("libAgentConfiguration.labels.channel", { id: operation.id }));
    if (operation.input.action === "remove" && next && !equal(next.find(row => row.id === operation.id), previous)) throw new Error(t("libAgentConfiguration.channels.editedAndRemoved", { id: operation.id }));
    if (next && !next.some(row => row.id === operation.id)) throw new Error(t("libAgentConfiguration.channels.removedAndConfigured", { id: operation.id }));
    add(t("libAgentConfiguration.channels.steps.setup", { action: operation.input.action, id: operation.id }), () => chatEndpointsApi.setup(operation.id, operation.input));
  }
  unique(operations.revokeIdentityLinks.map(row => `${row.endpointId}/${row.principalId}`), "channelOperations.revokeIdentityLinks");
  for (const operation of operations.revokeIdentityLinks) {
    if ((next && !next.some(row => row.id === operation.endpointId)) || operations.setup.some(row => row.id === operation.endpointId && row.input.action === "remove")) throw new Error(t("libAgentConfiguration.channels.removedAndIdentitiesEdited", { id: operation.endpointId }));
    const channel = requireItem(snapshot.channels, row => row.detail.id === operation.endpointId, t("libAgentConfiguration.labels.channel", { id: operation.endpointId }));
    requireItem(channel.principals, row => row.principalId === operation.principalId, t("libAgentConfiguration.labels.identity", { id: operation.principalId }));
    add(t("libAgentConfiguration.channels.steps.revokeIdentity", { id: operation.principalId }), () => chatEndpointsApi.revokeLink(operation.endpointId, operation.principalId));
  }
}
