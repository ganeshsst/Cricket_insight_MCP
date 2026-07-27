import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { UsersDatabaseService } from '../database/users-database.service.js';

/** Tables live in Aurora DB `app`, schema `"user"` (reserved word → must quote). */
const S = '"user"';

@Injectable()
export class ChatHistoryService {
  constructor(
    @Inject(UsersDatabaseService)
    private readonly db: UsersDatabaseService,
  ) {}

  async upsertProfile(input: {
    userId: string;
    email?: string;
    displayName?: string;
    avatarUrl?: string;
  }) {
    const userId = input.userId?.trim();
    if (!userId) {
      throw new BadRequestException('userId is required');
    }

    const result = await this.db.query(
      `INSERT INTO ${S}.app_profiles AS p
         (user_id, email, display_name, avatar_url, preferences, created_at, updated_at)
       VALUES ($1, $2, $3, $4, '{}'::jsonb, now(), now())
       ON CONFLICT (user_id) DO UPDATE SET
         email = COALESCE(EXCLUDED.email, p.email),
         display_name = COALESCE(EXCLUDED.display_name, p.display_name),
         avatar_url = COALESCE(EXCLUDED.avatar_url, p.avatar_url),
         updated_at = now()
       RETURNING user_id AS "userId", email, display_name AS "displayName",
                 date_of_birth AS "dateOfBirth", avatar_url AS "avatarUrl",
                 preferences, created_at AS "createdAt", updated_at AS "updatedAt"`,
      [
        userId,
        input.email ?? null,
        input.displayName ?? null,
        input.avatarUrl ?? null,
      ],
    );

    return result.rows[0];
  }

  async getProfile(userId: string) {
    const result = await this.db.query(
      `SELECT user_id AS "userId", email, display_name AS "displayName",
              date_of_birth AS "dateOfBirth", avatar_url AS "avatarUrl",
              preferences, created_at AS "createdAt", updated_at AS "updatedAt"
       FROM ${S}.app_profiles WHERE user_id = $1`,
      [userId],
    );
    if (!result.rows[0]) {
      throw new NotFoundException('Profile not found');
    }
    return result.rows[0];
  }

  async listChats(userId: string) {
    if (!userId?.trim()) {
      throw new BadRequestException('userId is required');
    }
    const result = await this.db.query(
      `SELECT id, user_id AS "userId", title, visibility,
              created_at AS "createdAt", updated_at AS "updatedAt"
       FROM ${S}.chats
       WHERE user_id = $1
       ORDER BY updated_at DESC`,
      [userId],
    );
    return { chats: result.rows };
  }

  async createChat(input: {
    userId: string;
    title?: string;
    visibility?: 'private' | 'public';
  }) {
    const userId = input.userId?.trim();
    if (!userId) {
      throw new BadRequestException('userId is required');
    }

    await this.upsertProfile({ userId });

    const result = await this.db.query(
      `INSERT INTO ${S}.chats (id, user_id, title, visibility, created_at, updated_at)
       VALUES (gen_random_uuid(), $1, $2, $3, now(), now())
       RETURNING id, user_id AS "userId", title, visibility,
                 created_at AS "createdAt", updated_at AS "updatedAt"`,
      [userId, input.title ?? 'New chat', input.visibility ?? 'private'],
    );
    return result.rows[0];
  }

  async getChat(chatId: string, userId: string) {
    if (!userId?.trim()) {
      throw new BadRequestException('userId is required');
    }

    const chatResult = await this.db.query(
      `SELECT id, user_id AS "userId", title, visibility,
              created_at AS "createdAt", updated_at AS "updatedAt"
       FROM ${S}.chats WHERE id = $1`,
      [chatId],
    );
    const chat = chatResult.rows[0];
    if (!chat) {
      throw new NotFoundException('Chat not found');
    }
    if (chat.userId !== userId) {
      throw new ForbiddenException('Chat does not belong to this user');
    }

    const messages = await this.db.query(
      `SELECT id, chat_id AS "chatId", role, content, page_json AS "pageJson",
              created_at AS "createdAt"
       FROM ${S}.messages
       WHERE chat_id = $1
       ORDER BY created_at ASC`,
      [chatId],
    );

    return { chat, messages: messages.rows };
  }

  async addMessage(
    chatId: string,
    input: {
      userId: string;
      role: 'user' | 'assistant';
      content?: string;
      pageJson?: unknown;
    },
  ) {
    await this.getChat(chatId, input.userId);

    if (input.role !== 'user' && input.role !== 'assistant') {
      throw new BadRequestException('role must be user or assistant');
    }

    const result = await this.db.query(
      `INSERT INTO ${S}.messages (id, chat_id, role, content, page_json, created_at)
       VALUES (gen_random_uuid(), $1, $2, $3, $4, now())
       RETURNING id, chat_id AS "chatId", role, content, page_json AS "pageJson",
                 created_at AS "createdAt"`,
      [
        chatId,
        input.role,
        input.content ?? null,
        input.pageJson ? JSON.stringify(input.pageJson) : null,
      ],
    );

    await this.db.query(
      `UPDATE ${S}.chats SET updated_at = now() WHERE id = $1`,
      [chatId],
    );

    return result.rows[0];
  }

  async updateChat(
    chatId: string,
    input: {
      userId: string;
      title?: string;
      visibility?: 'private' | 'public';
    },
  ) {
    await this.getChat(chatId, input.userId);

    const result = await this.db.query(
      `UPDATE ${S}.chats SET
         title = COALESCE($2, title),
         visibility = COALESCE($3, visibility),
         updated_at = now()
       WHERE id = $1
       RETURNING id, user_id AS "userId", title, visibility,
                 created_at AS "createdAt", updated_at AS "updatedAt"`,
      [chatId, input.title ?? null, input.visibility ?? null],
    );
    return result.rows[0];
  }
}
