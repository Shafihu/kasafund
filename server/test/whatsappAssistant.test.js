import assert from "node:assert/strict";
import test from "node:test";
import {
  classifyAccountIntent,
} from "../src/services/kasaAssistantService.js";
import { extractWhatsAppMessages } from "../src/services/whatsappService.js";

test("classifies supported read-only account questions", () => {
  assert.equal(classifyAccountIntent("What is my wallet balance?"), "wallet");
  assert.equal(classifyAccountIntent("When is my next contribution due?"), "due");
  assert.equal(classifyAccountIntent("show my groups"), "groups");
  assert.equal(classifyAccountIntent("What is my KYC status?"), "kyc");
  assert.equal(classifyAccountIntent("How does susu work?"), null);
});

test("extracts inbound messages from Meta webhook entries", () => {
  const message = {
    id: "wamid.123",
    from: "233200000000",
    type: "text",
    text: { body: "Hello" },
  };
  const payload = {
    entry: [{ changes: [{ value: { messages: [message] } }] }],
  };

  assert.deepEqual(extractWhatsAppMessages(payload), [message]);
  assert.deepEqual(extractWhatsAppMessages({ entry: [] }), []);
});
