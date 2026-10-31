import React from "react";
import { Redirect } from "wouter";

/** Historical assessment URLs remain valid, but Development opens chat instead. */
export default function ChefConversationEntry() {
  return <Redirect to="/coach-corner/home" />;
}
