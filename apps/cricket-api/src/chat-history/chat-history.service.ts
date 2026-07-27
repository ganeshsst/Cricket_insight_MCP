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

/**
 * API `userId` is always the Auth0 `sub` (text).
 * DB stores that on `app_profiles.auth0_user_id`; chats FK to `app_profiles.id` (UUID).
 */
@Injectable()
export class ChatHistoryService {
  constructor(
    @Inject(UsersDatabaseService)
    private readonly db: UsersDatabaseService,
  ) {}

  private requireAuth0UserId(userId: string | undefined): string {
    const auth0UserId = userId?.trim();
    if (!auth0UserId) {
      throw new BadRequestException('userId is required');
    }
    return auth0UserId;
  }

  /** Resolve Auth0 sub → internal profile UUID (creates profile if missing). */
  private async resolveProfileId(auth0UserId: string): Promise<string> {
    const profile = await this.upsertProfile({ userId: auth0UserId });
    return profile.id as string;
  }

  async upsertProfile(input: {
    userId: string;
    email?: string;
    displayName?: string;
    avatarUrl?: string;
  }) {
    const auth0UserId = this.requireAuth0UserId(input.userId);

    const result = await this.db.query(
      `INSERT INTO ${S}.app_profiles AS p
         (id, auth0_user_id, email, display_name, avatar_url, preferences, created_at, updated_at)
       VALUES (gen_random_uuid(), $1, $2, $3, $4, '{}'::jsonb, now(), now())
       ON CONFLICT (auth0_user_id) DO UPDATE SET
         email = COALESCE(EXCLUDED.email, p.email),
         display_name = COALESCE(EXCLUDED.display_name, p.display_name),
         avatar_url = COALESCE(EXCLUDED.avatar_url, p.avatar_url),
         updated_at = now()
       RETURNING id,
                 auth0_user_id AS "userId",
                 email,
                 display_name AS "displayName",
                 date_of_birth AS "dateOfBirth",
                 avatar_url AS "avatarUrl",
                 preferences,
                 created_at AS "createdAt",
                 updated_at AS "updatedAt"`,
      [
        auth0UserId,
        input.email ?? null,
        input.displayName ?? null,
        input.avatarUrl ?? null,
      ],
    );

    return result.rows[0];
  }

  async getProfile(userId: string) {
    const auth0UserId = this.requireAuth0UserId(userId);
    const result = await this.db.query(
      `SELECT id,
              auth0_user_id AS "userId",
              email,
              display_name AS "displayName",
              date_of_birth AS "dateOfBirth",
              avatar_url AS "avatarUrl",
              preferences,
              created_at AS "createdAt",
              updated_at AS "updatedAt"
       FROM ${S}.app_profiles
       WHERE auth0_user_id = $1`,
      [auth0UserId],
    );
    if (!result.rows[0]) {
      throw new NotFoundException('Profile not found');
    }
    return result.rows[0];
  }

  async listChats(userId: string) {
    const auth0UserId = this.requireAuth0UserId(userId);
    const result = await this.db.query(
      `SELECT c.id,
              p.auth0_user_id AS "userId",
              c.title,
              c.visibility,
              c.created_at AS "createdAt",
              c.updated_at AS "updatedAt"
       FROM ${S}.chats c
       JOIN ${S}.app_profiles p ON p.id = c.user_id
       WHERE p.auth0_user_id = $1
       ORDER BY c.updated_at DESC`,
      [auth0UserId],
    );
    return { chats: result.rows };
  }

  async createChat(input: {
    userId: string;
    title?: string;
    visibility?: 'private' | 'public';
  }) {
    const auth0UserId = this.requireAuth0UserId(input.userId);
    const profileId = await this.resolveProfileId(auth0UserId);

    const result = await this.db.query(
      `INSERT INTO ${S}.chats (id, user_id, title, visibility, created_at, updated_at)
       VALUES (gen_random_uuid(), $1::uuid, $2, $3, now(), now())
       RETURNING id,
                 $4::text AS "userId",
                 title,
                 visibility,
                 created_at AS "createdAt",
                 updated_at AS "updatedAt"`,
      [
        profileId,
        input.title ?? 'New chat',
        input.visibility ?? 'private',
        auth0UserId,
      ],
    );
    return result.rows[0];
  }

  async getChat(chatId: string, userId: string) {
    const auth0UserId = this.requireAuth0UserId(userId);

    const chatResult = await this.db.query(
      `SELECT c.id,
              p.auth0_user_id AS "userId",
              c.title,
              c.visibility,
              c.created_at AS "createdAt",
              c.updated_at AS "updatedAt"
       FROM ${S}.chats c
       JOIN ${S}.app_profiles p ON p.id = c.user_id
       WHERE c.id = $1::uuid`,
      [chatId],
    );
    const chat = chatResult.rows[0];
    if (!chat) {
      throw new NotFoundException('Chat not found');
    }
    if (chat.userId !== auth0UserId) {
      throw new ForbiddenException('Chat does not belong to this user');
    }

    const messages = await this.db.query(
      `SELECT id, chat_id AS "chatId", role, content, page_json AS "pageJson",
              created_at AS "createdAt"
       FROM ${S}.messages
       WHERE chat_id = $1::uuid
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
       VALUES (gen_random_uuid(), $1::uuid, $2, $3, $4, now())
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
      `UPDATE ${S}.chats SET updated_at = now() WHERE id = $1::uuid`,
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
    const auth0UserId = this.requireAuth0UserId(input.userId);
    await this.getChat(chatId, auth0UserId);

    const result = await this.db.query(
      `UPDATE ${S}.chats c SET
         title = COALESCE($2, c.title),
         visibility = COALESCE($3, c.visibility),
         updated_at = now()
       FROM ${S}.app_profiles p
       WHERE c.id = $1::uuid
         AND p.id = c.user_id
       RETURNING c.id,
                 p.auth0_user_id AS "userId",
                 c.title,
                 c.visibility,
                 c.created_at AS "createdAt",
                 c.updated_at AS "updatedAt"`,
      [chatId, input.title ?? null, input.visibility ?? null],
    );
    return result.rows[0];
  }
}
