import RNFS from "react-native-fs";
import { DecodedMessage } from "xmtp-react-native-sdk/lib/DecodedMessage";

import {
  Test,
  assert,
  createClients,
  delayToPropogate,
  isIos,
} from "./test-utils";
import {
  Client,
  Conversation,
  Group,
  ConversationContainer,
  ConversationVersion,
} from "../../../src/index";

export const groupTests: Test[] = [];

function test(name: string, perform: () => Promise<boolean>) {
  groupTests.push({ name, run: perform });
}

test("can make a MLS V3 client", async () => {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const keyBytes = new Uint8Array([
    233, 120, 198, 96, 154, 65, 132, 17, 132, 96, 250, 40, 103, 35, 125, 64,
    166, 83, 208, 224, 254, 44, 205, 227, 175, 49, 234, 129, 74, 252, 135, 145,
  ]);
  const client = await Client.createRandom({
    env: "local",
    appVersion: "Testing/0.0.0",
    enableAlphaMls: true,
    dbEncryptionKey: keyBytes,
  });

  return true;
});

test("can delete a local database", async () => {
  let [client, anotherClient] = await createClients(2);

  await client.conversations.newGroup([anotherClient.address]);
  await client.conversations.syncGroups();
  assert(
    (await client.conversations.listGroups()).length === 1,
    `should have a group size of 1 but was ${
      (await client.conversations.listGroups()).length
    }`,
  );

  await client.deleteLocalDatabase();
  client = await Client.createRandom({
    env: "local",
    appVersion: "Testing/0.0.0",
    enableAlphaMls: true,
    dbEncryptionKey: new Uint8Array([
      233, 120, 198, 96, 154, 65, 132, 17, 132, 96, 250, 40, 103, 35, 125, 64,
      166, 83, 208, 224, 254, 44, 205, 227, 175, 49, 234, 129, 74, 252, 135,
      145,
    ]),
  });
  await client.conversations.syncGroups();
  assert(
    (await client.conversations.listGroups()).length === 0,
    `should have a group size of 0 but was ${
      (await client.conversations.listGroups()).length
    }`,
  );

  return true;
});

test("can make a MLS V3 client with encryption key and database path", async () => {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const dbDirPath = `${RNFS.DocumentDirectoryPath}/xmtp_db`;
  const directoryExists = await RNFS.exists(dbDirPath);
  if (!directoryExists) {
    await RNFS.mkdir(dbDirPath);
  }
  const timestamp = Date.now().toString();
  const dbPath = `${dbDirPath}/myCoolApp${timestamp}.db3`;

  const key = new Uint8Array([
    233, 120, 198, 96, 154, 65, 132, 17, 132, 96, 250, 40, 103, 35, 125, 64,
    166, 83, 208, 224, 254, 44, 205, 227, 175, 49, 234, 129, 74, 252, 135, 145,
  ]);
  const client = await Client.createRandom({
    env: "local",
    appVersion: "Testing/0.0.0",
    enableAlphaMls: true,
    dbEncryptionKey: key,
    dbPath,
  });

  const anotherClient = await Client.createRandom({
    env: "local",
    appVersion: "Testing/0.0.0",
    enableAlphaMls: true,
    dbEncryptionKey: key,
  });

  await client.conversations.newGroup([anotherClient.address]);
  assert(
    (await client.conversations.listGroups()).length === 1,
    `should have a group size of 1 but was ${
      (await client.conversations.listGroups()).length
    }`,
  );

  const bundle = await client.exportKeyBundle();
  const clientFromBundle = await Client.createFromKeyBundle(bundle, {
    env: "local",
    appVersion: "Testing/0.0.0",
    enableAlphaMls: true,
    dbEncryptionKey: key,
    dbPath,
  });

  assert(
    clientFromBundle.address === client.address,
    `clients dont match ${client.address} and ${clientFromBundle.address}`,
  );

  assert(
    (await clientFromBundle.conversations.listGroups()).length === 1,
    `should have a group size of 1 but was ${
      (await clientFromBundle.conversations.listGroups()).length
    }`,
  );
  return true;
});

test("can make a MLS V3 client from bundle", async () => {
  const key = new Uint8Array([
    233, 120, 198, 96, 154, 65, 132, 17, 132, 96, 250, 40, 103, 35, 125, 64,
    166, 83, 208, 224, 254, 44, 205, 227, 175, 49, 234, 129, 74, 252, 135, 145,
  ]);

  const client = await Client.createRandom({
    env: "local",
    appVersion: "Testing/0.0.0",
    enableAlphaMls: true,
    dbEncryptionKey: key,
  });

  const anotherClient = await Client.createRandom({
    env: "local",
    appVersion: "Testing/0.0.0",
    enableAlphaMls: true,
    dbEncryptionKey: key,
  });

  const group1 = await client.conversations.newGroup([anotherClient.address]);

  assert(
    group1.clientAddress === client.address,
    `clients dont match ${client.address} and ${group1.clientAddress}`,
  );

  const bundle = await client.exportKeyBundle();
  const client2 = await Client.createFromKeyBundle(bundle, {
    env: "local",
    appVersion: "Testing/0.0.0",
    enableAlphaMls: true,
    dbEncryptionKey: key,
  });

  assert(
    client.address === client2.address,
    `clients dont match ${client2.address} and ${client.address}`,
  );

  const randomClient = await Client.createRandom({
    env: "local",
    appVersion: "Testing/0.0.0",
    enableAlphaMls: true,
    dbEncryptionKey: key,
  });

  const group = await client2.conversations.newGroup([randomClient.address]);

  assert(
    group.clientAddress === client2.address,
    `clients dont match ${client2.address} and ${group.clientAddress}`,
  );

  return true;
});

test("production MLS V3 client creation throws error", async () => {
  try {
    await Client.createRandom({
      env: "production",
      appVersion: "Testing/0.0.0",
      enableAlphaMls: true,
    });
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
  } catch (error) {
    return true;
  }
  throw new Error(
    "should throw error on MLS V3 client create when environment is not local",
  );
});

test("can message in a group", async () => {
  // Create three MLS enabled Clients
  const [alixClient, boClient, caroClient] = await createClients(3);

  // alix's num groups start at 0
  let alixGroups = await alixClient.conversations.listGroups();
  if (alixGroups.length !== 0) {
    throw new Error("num groups should be 0");
  }

  // alix creates a group
  const alixGroup = await alixClient.conversations.newGroup([
    boClient.address,
    caroClient.address,
  ]);

  // alix's num groups == 1
  alixGroups = await alixClient.conversations.listGroups();
  if (alixGroups.length !== 1) {
    throw new Error("num groups should be 1");
  }

  // alix group should match create time from list function
  assert(alixGroups[0].createdAt === alixGroup.createdAt, "group create time");

  // alix can confirm memberAddresses
  const memberAddresses = await alixGroup.memberAddresses();
  if (memberAddresses.length !== 3) {
    throw new Error("num group members should be 3");
  }
  const peerAddresses = await alixGroup.peerAddresses;
  if (peerAddresses.length !== 2) {
    throw new Error("num peer group members should be 2");
  }
  const lowercasedAddresses: string[] = memberAddresses.map((s) =>
    s.toLowerCase(),
  );
  if (
    !(
      lowercasedAddresses.includes(alixClient.address.toLowerCase()) &&
      lowercasedAddresses.includes(boClient.address.toLowerCase()) &&
      lowercasedAddresses.includes(caroClient.address.toLowerCase())
    )
  ) {
    throw new Error("missing address");
  }

  const lowercasedPeerAddresses: string[] = peerAddresses.map((s) =>
    s.toLowerCase(),
  );
  if (
    !(
      lowercasedPeerAddresses.includes(boClient.address.toLowerCase()) &&
      lowercasedPeerAddresses.includes(caroClient.address.toLowerCase())
    )
  ) {
    throw new Error("should include self");
  }

  // alix can send messages
  await alixGroup.send("hello, world");
  await alixGroup.send("gm");

  // bo's num groups == 1
  const boGroups = await boClient.conversations.listGroups();
  if (boGroups.length !== 1) {
    throw new Error(
      "num groups for bo should be 1, but it is" + boGroups.length,
    );
  }
  await delayToPropogate();
  // bo can read messages from alix
  const boMessages: DecodedMessage[] = await boGroups[0].messages();

  if (boMessages.length !== 2) {
    throw new Error(
      "num messages for bo should be 2, but it is" + boMessages.length,
    );
  }
  if (boMessages[0].content() !== "gm") {
    throw new Error("newest message should be 'gm'");
  }
  if (boMessages[1].content() !== "hello, world") {
    throw new Error("newest message should be 'hello, world'");
  }
  // bo can send a message
  await boGroups[0].send("hey guys!");

  // caro's num groups == 1
  const caroGroups = await caroClient.conversations.listGroups();
  if (caroGroups.length !== 1) {
    throw new Error(
      "num groups for caro should be 1, but it is" + caroGroups.length,
    );
  }

  // caro can read messages from alix and bo
  await caroGroups[0].sync();
  const caroMessages = await caroGroups[0].messages();

  if (caroMessages.length !== 3) {
    throw new Error(`length should be 3 but was ${caroMessages.length}`);
  }
  if (caroMessages[0].content() !== "hey guys!") {
    throw new Error(
      `newest Message should be 'hey guys!' but was ${caroMessages[0].content()}`,
    );
  }
  if (caroMessages[1].content() !== "gm") {
    throw new Error(
      `second Message should be 'gm' but was ${caroMessages[1].content()}`,
    );
  }

  return true;
});

test("can add members to a group", async () => {
  // Create three MLS enabled Clients
  const [alixClient, boClient, caroClient] = await createClients(3);

  // alix's num groups start at 0
  let alixGroups = await alixClient.conversations.listGroups();
  if (alixGroups.length !== 0) {
    throw new Error("num groups should be 0");
  }

  // bo's num groups start at 0
  let boGroups = await boClient.conversations.listGroups();
  if (boGroups.length !== 0) {
    throw new Error("num groups should be 0");
  }

  // caro's num groups start at 0
  let caroGroups = await caroClient.conversations.listGroups();
  if (caroGroups.length !== 0) {
    throw new Error("num groups should be 0");
  }

  // alix creates a group
  const alixGroup = await alixClient.conversations.newGroup([boClient.address]);

  // alix's num groups == 1
  alixGroups = await alixClient.conversations.listGroups();
  if (alixGroups.length !== 1) {
    throw new Error("num groups should be 1");
  }

  // alix can confirm memberAddresses
  const memberAddresses = await alixGroup.memberAddresses();
  if (memberAddresses.length !== 2) {
    throw new Error("num group members should be 2");
  }
  const lowercasedAddresses: string[] = memberAddresses.map((s) =>
    s.toLowerCase(),
  );
  if (
    !(
      lowercasedAddresses.includes(alixClient.address.toLowerCase()) &&
      lowercasedAddresses.includes(boClient.address.toLowerCase())
    )
  ) {
    throw new Error("missing address");
  }

  // alix can send messages
  await alixGroup.send("hello, world");
  await alixGroup.send("gm");

  // bo's num groups == 1
  boGroups = await boClient.conversations.listGroups();
  if (boGroups.length !== 1) {
    throw new Error(
      "num groups for bo should be 1, but it is" + boGroups.length,
    );
  }

  await alixGroup.addMembers([caroClient.address]);

  // caro's num groups == 1
  caroGroups = await caroClient.conversations.listGroups();
  if (caroGroups.length !== 1) {
    throw new Error(
      "num groups for caro should be 1, but it is" + caroGroups.length,
    );
  }
  const caroMessages = await caroGroups[0].messages();
  if (caroMessages.length !== 0) {
    throw new Error("num messages for caro should be 0");
  }

  const boGroupMembers = await boGroups[0].memberAddresses();
  if (boGroupMembers.length !== 3) {
    throw new Error("num group members should be 3");
  }

  return true;
});

test("can remove members from a group", async () => {
  // Create three MLS enabled Clients
  const [alixClient, boClient, caroClient] = await createClients(3);

  // alix's num groups start at 0
  let alixGroups = await alixClient.conversations.listGroups();
  if (alixGroups.length !== 0) {
    throw new Error("num groups should be 0");
  }

  // bo's num groups start at 0
  let boGroups = await boClient.conversations.listGroups();
  assert(boGroups.length === 0, "num groups should be 0");

  // caro's num groups start at 0
  let caroGroups = await caroClient.conversations.listGroups();
  if (caroGroups.length !== 0) {
    throw new Error("num groups should be 0");
  }

  // alix creates a group
  const alixGroup = await alixClient.conversations.newGroup([
    boClient.address,
    caroClient.address,
  ]);

  // alix's num groups == 1
  alixGroups = await alixClient.conversations.listGroups();
  if (alixGroups.length !== 1) {
    throw new Error("num groups should be 1");
  }

  // alix can confirm memberAddresses
  const memberAddresses = await alixGroup.memberAddresses();
  if (memberAddresses.length !== 3) {
    throw new Error("num group members should be 3");
  }
  const lowercasedAddresses: string[] = memberAddresses.map((s) =>
    s.toLowerCase(),
  );
  if (
    !(
      lowercasedAddresses.includes(alixClient.address.toLowerCase()) &&
      lowercasedAddresses.includes(boClient.address.toLowerCase())
    )
  ) {
    throw new Error("missing address");
  }

  // alix can send messages
  await alixGroup.send("hello, world");
  await alixGroup.send("gm");

  // bo's num groups == 1
  boGroups = await boClient.conversations.listGroups();
  if (boGroups.length !== 1) {
    throw new Error(
      "num groups for bo should be 1, but it is" + boGroups.length,
    );
  }

  // caro's num groups == 1
  caroGroups = await caroClient.conversations.listGroups();
  if (caroGroups.length !== 1) {
    throw new Error(
      "num groups for caro should be 1, but it is" + caroGroups.length,
    );
  }

  if (!caroGroups[0].isActive()) {
    throw new Error("caros group should be active");
  }

  await alixGroup.removeMembers([caroClient.address]);
  const alixGroupMembers = await alixGroup.memberAddresses();
  if (alixGroupMembers.length !== 2) {
    throw new Error("num group members should be 2");
  }

  if (await caroGroups[0].isActive()) {
    throw new Error("caros group should not be active");
  }

  const caroGroupMembers = await caroGroups[0].memberAddresses();
  if (caroGroupMembers.length !== 2) {
    throw new Error("num group members should be 2");
  }

  return true;
});

test("can stream groups", async () => {
  const [alixClient, boClient, caroClient] = await createClients(3);

  // Start streaming groups
  const groups: Group<any>[] = [];
  const cancelStreamGroups = await alixClient.conversations.streamGroups(
    async (group: Group<any>) => {
      groups.push(group);
    },
  );

  // caro creates a group with alix, so stream callback is fired
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const caroGroup = await caroClient.conversations.newGroup([
    alixClient.address,
  ]);
  await delayToPropogate();
  if ((groups.length as number) !== 1) {
    throw Error("Unexpected num groups (should be 1): " + groups.length);
  }

  // bo creates a group with alix so a stream callback is fired
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const boGroup = await boClient.conversations.newGroup([alixClient.address]);
  await delayToPropogate();
  if ((groups.length as number) !== 2) {
    throw Error("Unexpected num groups (should be 2): " + groups.length);
  }

  // * Note alix creating a group does not trigger alix conversations
  // group stream. Workaround is to syncGroups after you create and list manually
  // See https://github.com/xmtp/libxmtp/issues/504

  // alix creates a group
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const alixGroup = await alixClient.conversations.newGroup([
    boClient.address,
    caroClient.address,
  ]);
  await delayToPropogate();
  if (groups.length !== 2) {
    throw Error("Expected group length 2 but it is: " + groups.length);
  }
  // Sync groups after creation if you created a group
  const listedGroups = await alixClient.conversations.listGroups();
  await delayToPropogate();
  groups.push(listedGroups[listedGroups.length - 1]);
  if ((groups.length as number) !== 3) {
    throw Error("Expected group length 3 but it is: " + groups.length);
  }

  cancelStreamGroups();
  await delayToPropogate();

  // Creating a group should no longer trigger stream groups
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const caroSecond = await caroClient.conversations.newGroup([
    alixClient.address,
  ]);
  await delayToPropogate();
  if ((groups.length as number) !== 3) {
    throw Error("Unexpected num groups (should be 3): " + groups.length);
  }

  return true;
});

test("can list all groups and conversations", async () => {
  const [alixClient, boClient, caroClient] = await createClients(3);

  // Add one group and one conversation
  const boGroup = await boClient.conversations.newGroup([alixClient.address]);
  const alixConversation = await alixClient.conversations.newConversation(
    caroClient.address,
  );

  const listedContainers = await alixClient.conversations.listAll();

  // Verify information in listed containers is correct
  // BUG - List All returns in Chronological order on iOS
  // and reverse Chronological order on Android
  const first = isIos() ? 1 : 0;
  const second = isIos() ? 0 : 1;
  if (
    listedContainers[first].topic !== boGroup.topic ||
    listedContainers[first].version !== ConversationVersion.GROUP ||
    listedContainers[second].version !== ConversationVersion.DIRECT ||
    listedContainers[second].createdAt !== alixConversation.createdAt
  ) {
    throw Error("Listed containers should match streamed containers");
  }

  return true;
});

test("can stream all groups and conversations", async () => {
  const [alixClient, boClient, caroClient] = await createClients(3);

  // Start streaming groups and conversations
  const containers: ConversationContainer<any>[] = [];
  const cancelStreamAll = await alixClient.conversations.streamAll(
    async (conversationContainer: ConversationContainer<any>) => {
      containers.push(conversationContainer);
    },
  );

  // bo creates a group with alix, so stream callback is fired
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const boGroup = await boClient.conversations.newGroup([alixClient.address]);
  await delayToPropogate();
  if ((containers.length as number) !== 1) {
    throw Error("Unexpected num groups (should be 1): " + containers.length);
  }

  // bo creates a v2 Conversation with alix so a stream callback is fired
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const boConversation = await boClient.conversations.newConversation(
    alixClient.address,
  );
  await delayToPropogate();
  if ((containers.length as number) !== 2) {
    throw Error("Unexpected num groups (should be 2): " + containers.length);
  }

  if (
    containers[1].version === ConversationVersion.DIRECT &&
    boConversation.conversationID !==
      (containers[1] as Conversation<any>).conversationID
  ) {
    throw Error(
      "Conversation from streamed all should match conversationID with created conversation",
    );
  }

  // * Note alix creating a v2 Conversation does trigger alix conversations
  // stream.

  // alix creates a V2 Conversationgroup
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const alixConversation = await alixClient.conversations.newConversation(
    caroClient.address,
  );
  await delayToPropogate();
  if (containers.length !== 3) {
    throw Error("Expected group length 3 but it is: " + containers.length);
  }

  cancelStreamAll();
  await delayToPropogate();

  // Creating a group should no longer trigger stream groups
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const caroConversation = await caroClient.conversations.newGroup([
    alixClient.address,
  ]);
  await delayToPropogate();
  if ((containers.length as number) !== 3) {
    throw Error("Unexpected num groups (should be 3): " + containers.length);
  }

  return true;
});

test("canMessage", async () => {
  const bo = await Client.createRandom({ env: "local" });
  const alix = await Client.createRandom({ env: "local" });

  const canMessage = await bo.canMessage(alix.address);
  if (!canMessage) {
    throw new Error("should be able to message v2 client");
  }

  const [caro, chux] = await createClients(2);

  const canMessageV3 = await caro.canGroupMessage([chux.address]);
  if (!canMessageV3) {
    throw new Error("should be able to message v3 client");
  }
  return true;
});

test("can stream group messages", async () => {
  // Create three MLS enabled Clients
  const [alixClient, boClient, caroClient] = await createClients(3);

  // alix creates a group
  const alixGroup = await alixClient.conversations.newGroup([
    boClient.address,
    caroClient.address,
  ]);

  // Record message stream for this group
  const groupMessages: DecodedMessage[] = [];
  const cancelGroupMessageStream = await alixGroup.streamGroupMessages(
    async (message) => {
      groupMessages.push(message);
    },
  );

  // bo's num groups == 1
  const boGroup = (await boClient.conversations.listGroups())[0];

  for (let i = 0; i < 5; i++) {
    await boGroup.send({ text: `Message ${i}` });
    await delayToPropogate();
  }

  if (groupMessages.length !== 5) {
    throw Error("Unexpected convo messages count " + groupMessages.length);
  }
  for (let i = 0; i < 5; i++) {
    if (groupMessages[i].content() !== `Message ${i}`) {
      throw Error(
        "Unexpected group message content " + groupMessages[i].content(),
      );
    }
  }

  cancelGroupMessageStream();
  for (let i = 0; i < 5; i++) {
    await boGroup.send({ text: `Message ${i}` });
  }

  if (groupMessages.length !== 5) {
    throw Error("Unexpected convo messages count " + groupMessages.length);
  }

  return true;
});

test("can stream all messages", async () => {
  const [alix, bo, caro] = await createClients(3);

  await delayToPropogate();

  // Record message stream across all conversations
  const allMessages: DecodedMessage[] = [];
  await alix.conversations.streamAllMessages(async (message) => {
    allMessages.push(message);
  });

  // Start bo starts a new conversation.
  const boConvo = await bo.conversations.newConversation(alix.address);
  await delayToPropogate();

  for (let i = 0; i < 5; i++) {
    await boConvo.send({ text: `Message ${i}` });
    await delayToPropogate();
  }

  const count = allMessages.length;
  if (count !== 5) {
    throw Error("Unexpected all messages count " + allMessages.length);
  }

  const caroConvo = await caro.conversations.newConversation(alix.address);
  const caroGroup = await caro.conversations.newGroup([alix.address]);
  await delayToPropogate();
  for (let i = 0; i < 5; i++) {
    await caroConvo.send({ text: `Message ${i}` });
    await caroGroup.send({ text: `Message ${i}` });
    await delayToPropogate();
  }

  if (allMessages.length !== 10) {
    throw Error("Unexpected all messages count " + allMessages.length);
  }

  alix.conversations.cancelStreamAllMessages();

  await alix.conversations.streamAllMessages(async (message) => {
    allMessages.push(message);
  }, true);

  for (let i = 0; i < 5; i++) {
    await boConvo.send({ text: `Message ${i}` });
    await caroGroup.send({ text: `Message ${i}` });
    await delayToPropogate();
  }
  if (allMessages.length <= 15) {
    throw Error("Unexpected all messages count " + allMessages.length);
  }

  return true;
});

test("can make a group with admin permissions", async () => {
  const [adminClient, anotherClient] = await createClients(2);

  const group = await adminClient.conversations.newGroup(
    [anotherClient.address],
    "creator_admin",
  );

  if (group.permissionLevel !== "creator_admin") {
    throw Error(
      `Group permission level should be creator_admin but was ${group.permissionLevel}`,
    );
  }

  const isAdmin = await group.isAdmin();
  if (!isAdmin) {
    throw Error(`adminClient should be the admin`);
  }

  if (group.adminAddress.toLowerCase !== adminClient.address.toLowerCase) {
    throw Error(
      `adminClient should be the admin but was ${group.adminAddress}`,
    );
  }

  return true;
});

test("can paginate group messages", async () => {
  // Create three MLS enabled Clients
  const [alixClient, boClient] = await createClients(2);

  // alix creates a group
  const alixGroup = await alixClient.conversations.newGroup([boClient.address]);

  // alix can send messages
  await alixGroup.send("hello, world");
  await alixGroup.send("gm");

  const boGroups = await boClient.conversations.listGroups();
  if (boGroups.length !== 1) {
    throw new Error(
      "num groups for bo should be 1, but it is" + boGroups.length,
    );
  }
  await delayToPropogate();
  // bo can read messages from alix
  const boMessages: DecodedMessage[] = await boGroups[0].messages(false, 1);

  if (boMessages.length !== 1) {
    throw Error(`Should limit just 1 message but was ${boMessages.length}`);
  }

  return true;
});

test("can stream all group messages", async () => {
  const [alix, bo, caro] = await createClients(3);

  await delayToPropogate();

  // Start bo starts a new group.
  const boGroup = await bo.conversations.newGroup([alix.address]);
  await delayToPropogate();

  // Starts a new conversation.
  const caroGroup = await caro.conversations.newGroup([alix.address]);

  // Record message stream across all conversations
  const allMessages: DecodedMessage[] = [];
  await alix.conversations.streamAllGroupMessages(async (message) => {
    allMessages.push(message);
  });

  for (let i = 0; i < 5; i++) {
    await boGroup.send({ text: `Message ${i}` });
    await delayToPropogate();
  }

  const count = allMessages.length;
  if (count !== 5) {
    throw Error("Unexpected all messages count first" + allMessages.length);
  }

  await delayToPropogate();
  for (let i = 0; i < 5; i++) {
    await caroGroup.send({ text: `Message ${i}` });
    await delayToPropogate();
  }

  if (allMessages.length !== 10) {
    throw Error("Unexpected all messages count second" + allMessages.length);
  }

  alix.conversations.cancelStreamAllGroupMessages();
  await delayToPropogate();
  await alix.conversations.streamAllGroupMessages(async (message) => {
    allMessages.push(message);
  });

  for (let i = 0; i < 5; i++) {
    await boGroup.send({ text: `Message ${i}` });
    await delayToPropogate();
  }
  if (allMessages.length <= 10) {
    throw Error("Unexpected all messages count " + allMessages.length);
  }

  return true;
});

test("can streamAll from multiple clients", async () => {
  const [alix, bo, caro] = await createClients(3);

  // Setup stream alls
  const allBoConversations: any[] = [];
  const allAliConversations: any[] = [];

  await bo.conversations.streamAll(async (conversation) => {
    allBoConversations.push(conversation);
  });
  await alix.conversations.streamAll(async (conversation) => {
    allAliConversations.push(conversation);
  });

  // Start Caro starts a new conversation.
  await caro.conversations.newConversation(alix.address);
  await delayToPropogate();
  if (allBoConversations.length !== 0) {
    throw Error(
      "Unexpected all conversations count for Bo " +
        allBoConversations.length +
        " and Alix had " +
        allAliConversations.length,
    );
  }
  if (allAliConversations.length !== 1) {
    throw Error(
      "Unexpected all conversations count " + allAliConversations.length,
    );
  }
  return true;
});

test("can streamAll from multiple clients - swapped orderring", async () => {
  const [alix, bo, caro] = await createClients(3);

  // Setup stream alls
  const allBoConversations: any[] = [];
  const allAliConversations: any[] = [];

  await alix.conversations.streamAll(async (conversation) => {
    allAliConversations.push(conversation);
  });

  await bo.conversations.streamAll(async (conversation) => {
    allBoConversations.push(conversation);
  });

  // Start Caro starts a new conversation.
  await caro.conversations.newConversation(alix.address);
  await delayToPropogate();
  if (allBoConversations.length !== 0) {
    throw Error(
      "Unexpected all conversations count for Bo " +
        allBoConversations.length +
        " and Alix had " +
        allAliConversations.length,
    );
  }
  if (allAliConversations.length !== 1) {
    throw Error(
      "Unexpected all conversations count " + allAliConversations.length,
    );
  }
  return true;
});

test("can streamAllMessages from multiple clients", async () => {
  const [alix, bo, caro] = await createClients(3);

  // Setup stream
  const allBoMessages: any[] = [];
  const allAliMessages: any[] = [];

  await bo.conversations.streamAllMessages(async (conversation) => {
    allBoMessages.push(conversation);
  }, true);
  await alix.conversations.streamAllMessages(async (conversation) => {
    allAliMessages.push(conversation);
  }, true);

  // Start Caro starts a new conversation.
  const caroConversation = await caro.conversations.newConversation(
    alix.address,
  );
  await caroConversation.send({ text: `Message` });
  await delayToPropogate();
  if (allBoMessages.length !== 0) {
    throw Error("Unexpected all messages count for Bo " + allBoMessages.length);
  }

  if (allAliMessages.length !== 1) {
    throw Error(
      "Unexpected all conversations count for Ali " + allAliMessages.length,
    );
  }

  return true;
});

test("can streamAllMessages from multiple clients - swapped", async () => {
  const [alix, bo, caro] = await createClients(3);

  // Setup stream
  const allBoMessages: any[] = [];
  const allAliMessages: any[] = [];
  const caroGroup = await caro.conversations.newGroup([alix.address]);

  await alix.conversations.streamAllMessages(async (conversation) => {
    allAliMessages.push(conversation);
  }, true);
  await bo.conversations.streamAllMessages(async (conversation) => {
    allBoMessages.push(conversation);
  }, true);

  // Start Caro starts a new conversation.
  const caroConvo = await caro.conversations.newConversation(alix.address);
  await delayToPropogate();
  await caroConvo.send({ text: `Message` });
  await caroGroup.send({ text: `Message` });
  await delayToPropogate();
  if (allBoMessages.length !== 0) {
    throw Error(
      "Unexpected all conversations count for Bo " + allBoMessages.length,
    );
  }

  if (allAliMessages.length !== 2) {
    throw Error(
      "Unexpected all conversations count for Ali " + allAliMessages.length,
    );
  }

  return true;
});

test("can stream all group Messages from multiple clients", async () => {
  const [alix, bo, caro] = await createClients(3);

  // Setup stream
  const allAlixMessages: DecodedMessage[] = [];
  const allBoMessages: DecodedMessage[] = [];
  const alixGroup = await caro.conversations.newGroup([alix.address]);
  const boGroup = await caro.conversations.newGroup([bo.address]);

  await alixGroup.streamGroupMessages(async (message) => {
    allAlixMessages.push(message);
  });
  await boGroup.streamGroupMessages(async (message) => {
    allBoMessages.push(message);
  });

  // Start Caro starts a new conversation.
  await delayToPropogate();
  await alixGroup.send({ text: `Message` });
  await delayToPropogate();
  if (allBoMessages.length !== 0) {
    throw Error("Unexpected all messages count for Bo " + allBoMessages.length);
  }

  if (allAlixMessages.length !== 1) {
    throw Error(
      "Unexpected all messages count for Ali " + allAlixMessages.length,
    );
  }

  const alixConv = (await alix.conversations.listGroups())[0];
  await alixConv.send({ text: `Message` });
  await delayToPropogate();
  if (allBoMessages.length !== 0) {
    throw Error("Unexpected all messages count for Bo " + allBoMessages.length);
  }
  // @ts-ignore-next-line
  if (allAlixMessages.length !== 2) {
    throw Error(
      "Unexpected all messages count for Ali " + allAlixMessages.length,
    );
  }

  return true;
});

test("can stream all group Messages from multiple clients - swapped", async () => {
  const [alix, bo, caro] = await createClients(3);

  // Setup stream
  const allAlixMessages: DecodedMessage[] = [];
  const allBoMessages: DecodedMessage[] = [];
  const alixGroup = await caro.conversations.newGroup([alix.address]);
  const boGroup = await caro.conversations.newGroup([bo.address]);

  await boGroup.streamGroupMessages(async (message) => {
    allBoMessages.push(message);
  });
  await alixGroup.streamGroupMessages(async (message) => {
    allAlixMessages.push(message);
  });

  // Start Caro starts a new conversation.
  await delayToPropogate();
  await alixGroup.send({ text: `Message` });
  await delayToPropogate();
  if (allBoMessages.length !== 0) {
    throw Error("Unexpected all messages count for Bo " + allBoMessages.length);
  }

  if (allAlixMessages.length !== 1) {
    throw Error(
      "Unexpected all messages count for Ali " + allAlixMessages.length,
    );
  }

  const alixConv = (await alix.conversations.listGroups())[0];
  await alixConv.send({ text: `Message` });
  await delayToPropogate();
  if (allBoMessages.length !== 0) {
    throw Error("Unexpected all messages count for Bo " + allBoMessages.length);
  }
  // @ts-ignore-next-line
  if (allAlixMessages.length !== 2) {
    throw Error(
      "Unexpected all messages count for Ali " + allAlixMessages.length,
    );
  }

  return true;
});

test("creating a group should allow group", async () => {
  const [alix, bo] = await createClients(2);

  const group = await alix.conversations.newGroup([bo.address]);
  const consent = await alix.contacts.isGroupAllowed(group.id);

  if (!consent) {
    throw Error("Group should be allowed");
  }

  return true;
});

test("can allow a group", async () => {
  const [alix, bo] = await createClients(2);
  const alixGroup = await alix.conversations.newGroup([bo.address]);
  const startConsent = await bo.contacts.isGroupAllowed(alixGroup.id);
  if (startConsent) {
    throw Error("Group should not be allowed");
  }
  await bo.contacts.allowGroups([alixGroup.id]);
  const isAllowed = await bo.contacts.isGroupAllowed(alixGroup.id);
  if (!isAllowed) {
    throw Error("Group should be allowed");
  }

  return true;
});

test("can deny a group", async () => {
  const [alix, bo] = await createClients(2);
  const alixGroup = await alix.conversations.newGroup([bo.address]);
  const startConsent = await bo.contacts.isGroupDenied(alixGroup.id);
  if (startConsent) {
    throw Error("Group should be unknown");
  }
  await bo.contacts.denyGroups([alixGroup.id]);
  const isDenied = await bo.contacts.isGroupDenied(alixGroup.id);
  if (!isDenied) {
    throw Error("Group should be denied");
  }
  await bo.contacts.allowGroups([alixGroup.id]);
  const isAllowed = await bo.contacts.isGroupAllowed(alixGroup.id);
  if (!isAllowed) {
    throw Error("Group should be allowed");
  }

  return true;
});

test("can check if group is allowed", async () => {
  const [alix, bo] = await createClients(2);
  const alixGroup = await alix.conversations.newGroup([bo.address]);
  const startConsent = await bo.contacts.isGroupAllowed(alixGroup.id);
  if (startConsent) {
    throw Error("Group should not be allowed by default");
  }
  await bo.contacts.allowGroups([alixGroup.id]);
  const consent = await bo.contacts.isGroupAllowed(alixGroup.id);
  if (!consent) {
    throw Error("Group should be allowed");
  }

  return true;
});

test("can check if group is denied", async () => {
  const [alix, bo] = await createClients(2);
  const alixGroup = await alix.conversations.newGroup([bo.address]);
  const startConsent = await bo.contacts.isGroupDenied(alixGroup.id);
  if (startConsent) {
    throw Error("Group should not be denied by default");
  }
  await bo.contacts.denyGroups([alixGroup.id]);
  const consent = await bo.contacts.isGroupDenied(alixGroup.id);
  if (!consent) {
    throw Error("Group should be denied");
  }
  return true;
});

test("skipSync parameter behaves as expected", async () => {
  const [alix, bo, caro] = await createClients(3);
  const alixGroup = await alix.conversations.newGroup([bo.address]);

  await alixGroup.send({ text: "hello" });

  // List groups with skipSync true will return empty until the first sync
  let boGroups = await bo.conversations.listGroups(true);
  assert(boGroups.length === 0, "num groups for bo is 0 until we sync");

  await bo.conversations.syncGroups();

  boGroups = await bo.conversations.listGroups(true);
  assert(boGroups.length === 1, "num groups for bo is 1");

  // Num members will include the initial num of members even before sync
  let numMembers = (await boGroups[0].memberAddresses(true)).length;
  assert(numMembers === 2, "num members should be 2");

  // Num messages for a group will be 0 until we sync the group
  let numMessages = (await boGroups[0].messages(true)).length;
  assert(numMessages === 0, "num members should be 1");

  await bo.conversations.syncGroups();

  // Num messages is still 0 because we didnt sync the group itself
  numMessages = (await boGroups[0].messages(true)).length;
  assert(numMessages === 0, "num messages should be 0");

  await boGroups[0].sync();

  // after syncing the group we now see the correct number of messages
  numMessages = (await boGroups[0].messages(true)).length;
  assert(numMessages === 1, "num members should be 1");

  await alixGroup.addMembers([caro.address]);

  numMembers = (await boGroups[0].memberAddresses(true)).length;
  assert(numMembers === 2, "num members should be 2");

  await bo.conversations.syncGroups();

  // Even though we synced the groups, we need to sync the group itself to see the new member
  numMembers = (await boGroups[0].memberAddresses(true)).length;
  assert(numMembers === 2, "num members should be 2");

  await boGroups[0].sync();

  numMembers = (await boGroups[0].memberAddresses(true)).length;
  assert(numMembers === 3, "num members should be 3");

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const _alixGroup2 = await alix.conversations.newGroup([
    bo.address,
    caro.address,
  ]);
  boGroups = await bo.conversations.listGroups();
  assert(boGroups.length === 2, "num groups for bo is 2");

  // Even before syncing the group, syncGroups will return the initial number of members
  numMembers = (await boGroups[1].memberAddresses(true)).length;
  assert(numMembers === 3, "num members should be 3");

  return true;
});

// Commenting this out so it doesn't block people, but nice to have?
// test('can stream messages for a long time', async () => {
//   const bo = await Client.createRandom({ env: 'local', enableAlphaMls: true })
//   await delayToPropogate()
//   const alix = await Client.createRandom({ env: 'local', enableAlphaMls: true })
//   await delayToPropogate()
//   const caro = await Client.createRandom({ env: 'local', enableAlphaMls: true })
//   await delayToPropogate()

//   // Setup stream alls
//   const allBoMessages: any[] = []
//   const allAliMessages: any[] = []

//   const group = await caro.conversations.newGroup([alix.address])
//   await bo.conversations.streamAllMessages(async (conversation) => {
//     allBoMessages.push(conversation)
//   }, true)
//   await alix.conversations.streamAllMessages(async (conversation) => {
//     allAliMessages.push(conversation)
//   }, true)

//   // Wait for 15 minutes
//   await delayToPropogate(15 * 1000 * 60)

//   // Start Caro starts a new conversation.
//   const convo = await caro.conversations.newConversation(alix.address)
//   await group.send({ text: 'hello' })
//   await convo.send({ text: 'hello' })
//   await delayToPropogate()
//   if (allBoMessages.length !== 0) {
//     throw Error('Unexpected all conversations count ' + allBoMessages.length)
//   }
//   if (allAliMessages.length !== 2) {
//     throw Error('Unexpected all conversations count ' + allAliMessages.length)
//   }

//   return true
// })
