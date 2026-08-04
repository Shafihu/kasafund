const simulatedGroupTimes = new Map();

function key(groupId) {
  return String(groupId?._id || groupId);
}

export function nowForGroup(groupId) {
  const simulated = simulatedGroupTimes.get(key(groupId));
  return simulated ? new Date(simulated) : new Date();
}

export function getSimulatedGroupTime(groupId) {
  const simulated = simulatedGroupTimes.get(key(groupId));
  return simulated ? new Date(simulated) : null;
}

export function setSimulatedGroupTime(groupId, value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) throw new Error("Invalid simulated time");
  simulatedGroupTimes.set(key(groupId), date);
  return new Date(date);
}

export function clearSimulatedGroupTime(groupId) {
  simulatedGroupTimes.delete(key(groupId));
}
