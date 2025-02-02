// For Talk (talk, group(chat), etc)

import type { NestedArray, ProtocolKey } from "../../libs/thrift/declares.ts";
import type * as LINETypes from "../../libs/thrift/line_types.ts";
import type { LooseType } from "../../entities/common.ts";
import { ChannelClient } from "./channel-client.ts";
import type { Buffer } from "node:buffer";

export class TalkClient extends ChannelClient {
	protected TalkService_API_PATH = "/S4";
	protected TalkService_PROTOCOL_TYPE: ProtocolKey = 4;

	protected TalkService_API_PATH_TBINARY = "/S3";

	protected TalkService_PROTOCOL_TYPE_TBINARY: ProtocolKey = 4;
	protected SyncService_API_PATH = "/SYNC4";
	protected SyncService_PROTOCOL_TYPE: ProtocolKey = 4;

	/**
	 * @description Get line events.
	 */
	public async sync(
		options: {
			limit?: number;
			revision?: number;
			globalRev?: number;
			individualRev?: number;
		} = {},
	): Promise<LINETypes.SyncResponse> {
		const { limit, revision, individualRev, globalRev } = {
			limit: 100,
			revision: 0,
			globalRev: 0,
			individualRev: 0,
			...options,
		};
		return await this.request(
			[
				[10, 1, revision],
				[8, 2, limit],
				[10, 3, globalRev],
				[10, 4, individualRev],
			],
			"sync",
			this.SyncService_PROTOCOL_TYPE,
			"SyncResponse",
			this.SyncService_API_PATH,
		);
	}

	/**
	 * @description Send message to talk.
	 */
	public async sendMessage(options: {
		to: string;
		text?: string;
		contentType?: number;
		contentMetadata?: LooseType;
		relatedMessageId?: string;
		location?: LINETypes.Location;
		chunk?: string[] | Buffer[];
		e2ee?: boolean;
	}): Promise<LINETypes.Message> {
		const {
			to,
			text,
			contentType,
			contentMetadata,
			relatedMessageId,
			location,
			e2ee,
			chunk,
		} = {
			contentType: 0,
			contentMetadata: {},
			e2ee: false,
			...options,
		};
		if (e2ee && !chunk) {
			const chunk = await this.encryptE2EEMessage(
				to,
				text || location,
				contentType,
			);
			const _contentMetadata = {
				...contentMetadata,
				...{
					e2eeVersion: "2",
					contentType: contentType.toString(),
					e2eeMark: "2",
				},
			};
			const options = {
				to,
				contentType,
				contentMetadata: _contentMetadata,
				relatedMessageId,
				e2ee,
				chunk,
			};
			return await this.sendMessage(options);
		}

		const message: NestedArray = [
			[11, 2, to],
			[10, 5, 0], // createdTime
			[10, 6, 0], // deliveredTime
			[2, 14, false], // hasContent
			[8, 15, contentType],
			[13, 18, [11, 11, contentMetadata]],
			[3, 19, 0], // sessionId
		];

		if (text !== undefined) {
			message.push([11, 10, text]);
		}

		if (location !== undefined) {
			const locationObj = [
				[11, 1, location.title || "LINEJS"],
				[11, 2, location.address || "https://github.com/evex-dev/linejs"],
				[4, 3, location.latitude || 0],
				[4, 4, location.longitude || 0],
				[11, 6, location.categoryId || "PC0"],
				[8, 7, location.provider || 2],
			];
			message.push([12, 11, locationObj]);
		}

		if (chunk !== undefined) {
			message.push([15, 20, [11, chunk]]);
		}

		if (relatedMessageId !== undefined) {
			message.push([11, 21, relatedMessageId]);
			message.push([8, 22, 3]); // messageRelationType; FORWARD(0), AUTO_REPLY(1), SUBORDINATE(2), REPLY(3);
			message.push([8, 24, 1]);
		}
		try {
			return await this.direct_request(
				[
					[8, 1, 0],
					[12, 2, message],
				],
				"sendMessage",
				this.TalkService_PROTOCOL_TYPE,
				"Message",
				this.TalkService_API_PATH,
			);
		} catch (error) {
			if ((error.data?.code as string).includes("E2EE") && !e2ee) {
				options.e2ee = true;
				return await this.sendMessage(options);
			} else {
				throw error;
			}
		}
	}

	/**
	 * @description Unsend message.
	 */
	public async unsendMessage(options: {
		messageId: string;
	}): Promise<LINETypes.UnsendMessageResponse> {
		const { messageId } = {
			...options,
		};
		return await this.direct_request(
			[
				[
					12,
					1,
					[
						[8, 1, 0],
						[11, 2, messageId],
					],
				],
			],
			"unsendMessage",
			this.TalkService_PROTOCOL_TYPE,
			"UnsendMessageResponse",
			this.TalkService_API_PATH,
		);
	}

	/**
	 * @description React to the message.
	 */
	public async reactToMessage(options: {
		messageId: string;
		reactionType: LINETypes.MessageReactionType;
	}): Promise<LINETypes.ReactToMessageResponse> {
		const { messageId, reactionType } = {
			...options,
		};
		return await this.direct_request(
			[
				[
					[
						12,
						1,
						[
							[8, 1, 0],
							[10, 2, messageId],
							[12, 3, [[8, 1, reactionType]]],
						],
					],
				],
			],
			"reactToMessage",
			this.TalkService_PROTOCOL_TYPE,
			"ReactToMessageResponse",
			this.TalkService_API_PATH,
		);
	}

	/**
	 * @description Will override.
	 */
	public async encryptE2EEMessage(..._arg: LooseType): Promise<LooseType[]> {
		return (await Symbol("Unreachable")) as LooseType;
	}

	public async getE2EEPublicKeys(): Promise<LINETypes.E2EEPublicKey[]> {
		return (
			await this.direct_request(
				[],
				"getE2EEPublicKeys",
				this.TalkService_PROTOCOL_TYPE,
				false,
				this.TalkService_API_PATH,
			)
		).map((e: LooseType) => this.parser.rename_thrift("E2EEPublicKey", e));
	}

	public async negotiateE2EEPublicKey(options: {
		mid: string;
	}): Promise<LINETypes.E2EENegotiationResult> {
		const { mid } = { ...options };
		return await this.direct_request(
			[[11, 2, mid]],
			"negotiateE2EEPublicKey",
			this.TalkService_PROTOCOL_TYPE,
			"E2EENegotiationResult",
			this.TalkService_API_PATH,
		);
	}

	public async getLastE2EEGroupSharedKey(options: {
		keyVersion: number;
		chatMid: string;
	}): Promise<LINETypes.E2EEGroupSharedKey> {
		const { keyVersion, chatMid } = { ...options };
		return await this.direct_request(
			[
				[8, 2, keyVersion],
				[11, 3, chatMid],
			],
			"getLastE2EEGroupSharedKey",
			this.TalkService_PROTOCOL_TYPE,
			"E2EEGroupSharedKey",
			this.TalkService_API_PATH,
		);
	}

	/**
	 * @description Mark as read.
	 */
	public async sendChatChecked(options: {
		chatMid: string;
		lastMessageId: string;
	}): Promise<void> {
		const { lastMessageId, chatMid } = { ...options };
		return await this.direct_request(
			[
				[8, 1, 0],
				[11, 2, chatMid],
				[11, 3, lastMessageId],
			],
			"sendChatChecked",
			this.TalkService_PROTOCOL_TYPE,
			false,
			this.TalkService_API_PATH,
		);
	}

	/**
	 * @description Get the number of past messages specified by count.
	 */
	public async getPreviousMessagesV2(options: {
		mid: string;
		time: number;
		id: number;
		count?: number;
	}): Promise<LINETypes.Message[]> {
		const { mid, time, id, count } = { count: 3000, ...options };
		return (
			await this.direct_request(
				[
					[11, 2, mid],
					[
						12,
						3,
						[
							[10, 1, time],
							[10, 2, id],
						],
					],
					[8, 4, count],
				],
				"getPreviousMessagesV2",
				this.TalkService_PROTOCOL_TYPE,
				false,
				this.TalkService_API_PATH,
			)
		).map((e: LooseType) => this.parser.rename_thrift("Message", e));
	}

	/**
	 * @description Get the number of past messages specified by count from the specified chat.
	 */
	public async getRecentMessagesV2(options: {
		to: string;
		count?: number;
	}): Promise<LINETypes.Message[]> {
		const { to, count } = { count: 300, ...options };
		return (
			await this.direct_request(
				[
					[
						[11, 2, to],
						[8, 3, count],
					],
				],
				"getRecentMessagesV2",
				this.TalkService_PROTOCOL_TYPE,
				false,
				this.TalkService_API_PATH,
			)
		).map((e: LooseType) => this.parser.rename_thrift("Message", e));
	}

	/**
	 * @description Get user information from mid.
	 */
	public async getContact(options: {
		mid: string;
	}): Promise<LINETypes.Contact> {
		const { mid } = { ...options };
		return await this.direct_request(
			[[11, 2, mid]],
			"getContact",
			this.TalkService_PROTOCOL_TYPE,
			"Contact",
			this.TalkService_API_PATH,
		);
	}

	/**
	 * @description Get users information from mids.
	 */
	public async getContacts(options: {
		mids: string[];
	}): Promise<LINETypes.Contact[]> {
		const { mids } = { ...options };
		return (
			await this.direct_request(
				[[15, 2, [11, mids]]],
				"getContacts",
				this.TalkService_PROTOCOL_TYPE,
				false,
				this.TalkService_API_PATH,
			)
		).map((e: LooseType) => this.parser.rename_thrift("Contact", e));
	}

	public async getContactsV2(options: {
		mids: string[];
	}): Promise<LINETypes.GetContactsV2Response> {
		const { mids } = { ...options };
		return await this.request(
			[[15, 1, [11, mids]]],
			"getContactsV2",
			this.TalkService_PROTOCOL_TYPE,
			"GetContactsV2Response",
			this.TalkService_API_PATH,
		);
	}

	/**
	 * @description Get chats information from gids.
	 */
	public async getChats(options: {
		gids: string[];
		withMembers?: boolean;
		withInvitees?: boolean;
	}): Promise<LINETypes.GetChatsResponse> {
		const { gids, withInvitees, withMembers } = {
			withInvitees: true,
			withMembers: true,
			...options,
		};
		return await this.request(
			[
				[15, 1, [11, gids]],
				[2, 2, withMembers],
				[2, 3, withInvitees],
			],
			"getChats",
			this.TalkService_PROTOCOL_TYPE,
			"GetChatsResponse",
			this.TalkService_API_PATH,
		);
	}

	/**
	 * @description Get information on all the chats joined.
	 */
	public async getAllChatMids(
		options: {
			withMembers?: boolean;
			withInvitees?: boolean;
		} = {},
	): Promise<LINETypes.GetAllChatMidsResponse> {
		const { withInvitees, withMembers } = {
			withInvitees: true,
			withMembers: true,
			...options,
		};
		return await this.direct_request(
			[
				[
					12,
					1,
					[
						[2, 1, withMembers],
						[2, 2, withInvitees],
					],
				],
				[8, 2, 7],
			],
			"getAllChatMids",
			this.TalkService_PROTOCOL_TYPE,
			"GetAllChatMidsResponse",
			this.TalkService_API_PATH,
		);
	}

	/**
	 * @description Kick out members of the chat.
	 */
	public async deleteOtherFromChat(options: {
		to: string;
		mid: string;
	}): Promise<LINETypes.DeleteOtherFromChatResponse> {
		const { to, mid } = {
			...options,
		};
		return await this.direct_request(
			[
				[8, 1, 0],
				[11, 2, to],
				[14, 3, [11, [mid]]],
			],
			"deleteOtherFromChat",
			this.TalkService_PROTOCOL_TYPE,
			"DeleteOtherFromChatResponse",
			this.TalkService_API_PATH,
		);
	}

	/**
	 * @description Leave the chat.
	 */
	public async deleteSelfFromChat(options: {
		to: string;
	}): Promise<LINETypes.DeleteSelfFromChatResponse> {
		const { to } = {
			...options,
		};
		return await this.request(
			[
				[8, 1, 0],
				[11, 2, to],
			],
			"deleteSelfFromChat",
			this.TalkService_PROTOCOL_TYPE,
			"DeleteSelfFromChatResponse",
			this.TalkService_API_PATH,
		);
	}

	/**
	 * @description Invite mids into the chat.
	 */
	public async inviteIntoChat(options: {
		to: string;
		mids: string[];
	}): Promise<LINETypes.InviteIntoChatResponse> {
		const { to, mids } = {
			...options,
		};
		return await this.request(
			[
				[
					12,
					1,
					[
						[8, 1, 0],
						[11, 2, to],
						[14, 3, [[11, mids]]],
					],
				],
			],
			"inviteIntoChat",
			this.TalkService_PROTOCOL_TYPE,
			"InviteIntoChatResponse",
			this.TalkService_API_PATH,
		);
	}

	/**
	 * @description Accept the chat invitation and join.
	 */
	public async acceptChatInvitation(options: {
		to: string;
	}): Promise<LINETypes.AcceptChatInvitationByTicketResponse> {
		const { to } = {
			...options,
		};
		return await this.request(
			[
				[8, 1, 0], // [8, 1, this.getCurrReqId()]...?
				[11, 2, to],
			],
			"acceptChatInvitation",
			this.TalkService_PROTOCOL_TYPE,
			"AcceptChatInvitationByTicketResponse",
			this.TalkService_API_PATH,
		);
	}

	/**
	 * @description Issue a ticket to join the chat.
	 */
	public async reissueChatTicket(options: {
		groupMid: string;
	}): Promise<LINETypes.ReissueChatTicketResponse> {
		const { groupMid } = {
			...options,
		};
		return await this.request(
			[
				[8, 1, 0], // reqSeq
				[11, 2, groupMid],
			],
			"reissueChatTicket",
			this.TalkService_PROTOCOL_TYPE,
			"ReissueChatTicketResponse",
			this.TalkService_API_PATH,
		);
	}

	/**
	 * @description Find the chat from the ticket.
	 */
	public async findChatByTicket(options: {
		ticketId: string;
	}): Promise<LINETypes.FindChatByTicketResponse> {
		const { ticketId } = {
			...options,
		};
		return await this.request(
			[[11, 1, ticketId]],
			"findChatByTicket",
			this.TalkService_PROTOCOL_TYPE,
			"FindChatByTicketResponse",
			this.TalkService_API_PATH,
		);
	}

	/**
	 * @description Join the chat using the ticket.
	 */
	public async acceptChatInvitationByTicket(options: {
		to: string;
		ticket: string;
	}): Promise<LINETypes.AcceptChatInvitationByTicketResponse> {
		const { to, ticket } = {
			...options,
		};
		return await this.request(
			[
				[8, 1, 0],
				[11, 2, to],
				[11, 3, ticket],
			],
			"acceptChatInvitationByTicket",
			this.TalkService_PROTOCOL_TYPE,
			"AcceptChatInvitationByTicketResponse",
			this.TalkService_API_PATH,
		);
	}

	/**
	 * @description Update the information for the specified chat.
	 */
	public async updateChat(options: {
		chatMid: string;
		chatSet: LINETypes.Chat;
		updatedAttribute: number;
	}): Promise<LINETypes.UpdateChatResponse> {
		const { chatMid, chatSet, updatedAttribute } = {
			...options,
		};

		return await this.request(
			[
				[8, 1, 0], // seq?
				[
					12,
					2,
					[
						chatSet.type ? [8, 1, chatSet.type] : [8, 1, 1],
						[11, 2, chatMid],
						chatSet.notificationDisabled
							? [2, 4, chatSet.notificationDisabled]
							: null,
						chatSet.chatName ? [11, 6, chatSet.chatName] : null,
						chatSet.picturePath ? [11, 7, chatSet.picturePath] : null,
						chatSet.extra?.groupExtra
							? [
									12,
									8,
									[
										[
											12,
											1,
											[
												[2, 2, chatSet.extra.groupExtra.preventedJoinByTicket],
												[2, 6, chatSet.extra.groupExtra.addFriendDisabled],
												[2, 7, chatSet.extra.groupExtra.ticketDisabled],
											],
										],
									],
								]
							: null,
					],
				],
				[8, 3, updatedAttribute],
			],
			"updateChat",
			this.TalkService_PROTOCOL_TYPE,
			"UpdateChatResponse",
			this.TalkService_API_PATH,
		);
	}
}
