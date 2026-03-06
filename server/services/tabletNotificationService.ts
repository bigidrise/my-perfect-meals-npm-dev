import { pushToUser, pushToCoachOfClient } from "./pushNotify";

export function notifyClientOfMessage(clientUserId: string): void {
  pushToUser(clientUserId, {
    title: "New message from your coach",
    body: "You have a new message in your coaching tablet.",
    url: "/client-tablet",
  }).catch((err) =>
    console.error("Tablet notification to client failed:", err)
  );
}

export function notifyProfessionalOfMessage(
  clientUserId: string,
  clientName: string
): void {
  pushToCoachOfClient(clientUserId, {
    title: `New message from client: ${clientName}`,
    body: "A client sent you a message in the coaching tablet.",
    url: "/pro/clients",
  }).catch((err) =>
    console.error("Tablet notification to professional failed:", err)
  );
}

export function notifyClientOfNote(clientUserId: string): void {
  pushToUser(clientUserId, {
    title: "Your coach updated your program notes",
    body: "New notes have been added to your coaching file.",
    url: "/client-tablet",
  }).catch((err) =>
    console.error("Tablet note notification to client failed:", err)
  );
}
