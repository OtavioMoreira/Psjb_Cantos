import path from "node:path";
import { ActivateUserAction } from "./actions/admin/ActivateUserAction.js";
import { ListUsersAction } from "./actions/admin/ListUsersAction.js";
import { LoginAction } from "./actions/auth/LoginAction.js";
import { LogoutAction } from "./actions/auth/LogoutAction.js";
import { RefreshSessionAction } from "./actions/auth/RefreshSessionAction.js";
import { CreateUserAction } from "./actions/users/CreateUserAction.js";
import { GetMeAction } from "./actions/users/GetMeAction.js";
import { UpdateMyPhotoAction } from "./actions/users/UpdateMyPhotoAction.js";
import { SearchUsersAction } from "./actions/users/SearchUsersAction.js";
import {
  CreateMassAction,
  DeleteMassAction,
  DuplicateMassAction,
  GetMassAction,
  LeaveMassAction,
  ListMassesAction,
  ShareMassAction,
  UpdateMassAction,
} from "./actions/masses/MassActions.js";
import { CreateShareLinkAction, JoinMassAction, RevokeShareLinkAction } from "./actions/masses/ShareLinkActions.js";
import {
  CreateSongAction,
  DeleteSongAction,
  GetSongAction,
  ListSongsAction,
  RemoveSongFileAction,
  UpdateSongAction,
  UploadSongFileAction,
} from "./actions/songs/SongActions.js";
import { PublishSiteAction } from "./actions/songs/PublishSiteAction.js";
import { DeployHookPublisher } from "./services/DeployHookPublisher.js";
import { CreateFlagAction, DeleteFlagAction, ListFlagsAction, UpdateFlagAction } from "./actions/songs/FlagActions.js";
import { CreateMovementAction, DeleteMovementAction, ListMovementsAction, RenameMovementAction } from "./actions/movements/MovementActions.js";
import type { Env } from "./config/env.js";
import { createPool, type Pool } from "./database/pool.js";
import type {
  Clock,
  FileStorage,
  FlagRepository,
  MassRepository,
  MovementRepository,
  PasswordHasher,
  SessionRepository,
  SitePublisher,
  SongRepository,
  TokenService,
  UserRepository,
} from "./interfaces/index.js";
import { PgFlagRepository } from "./repositories/PgFlagRepository.js";
import { PgSongRepository } from "./repositories/PgSongRepository.js";
import { PgMassRepository } from "./repositories/PgMassRepository.js";
import { PgMovementRepository } from "./repositories/PgMovementRepository.js";
import { PgSessionRepository } from "./repositories/PgSessionRepository.js";
import { PgUserRepository } from "./repositories/PgUserRepository.js";
import { Argon2PasswordHasher } from "./services/Argon2PasswordHasher.js";
import { JoseTokenService } from "./services/JoseTokenService.js";
import { LocalDiskStorage } from "./services/LocalDiskStorage.js";
import { VercelBlobStorage } from "./services/VercelBlobStorage.js";

/** Adaptadores (lado de fora do hexágono). Nos testes, trocados por versões em memória. */
export interface Adapters {
  users: UserRepository;
  sessions: SessionRepository;
  movements: MovementRepository;
  masses: MassRepository;
  songs: SongRepository;
  flags: FlagRepository;
  site: SitePublisher;
  hasher: PasswordHasher;
  tokens: TokenService;
  storage: FileStorage;
  clock: Clock;
}

export function buildContainer(env: Env, adapters: Adapters) {
  const ttl = { shortDays: env.REFRESH_TTL_SHORT_DAYS, longDays: env.REFRESH_TTL_LONG_DAYS };
  const deps = { ...adapters, ttl };
  return {
    env,
    tokens: adapters.tokens,
    actions: {
      login: new LoginAction(deps),
      refresh: new RefreshSessionAction(deps),
      logout: new LogoutAction(deps),
      createUser: new CreateUserAction(deps),
      getMe: new GetMeAction(deps),
      updateMyPhoto: new UpdateMyPhotoAction(deps),
      listUsers: new ListUsersAction(deps),
      activateUser: new ActivateUserAction(deps),
      searchUsers: new SearchUsersAction(deps),
      listMovements: new ListMovementsAction(deps),
      createMovement: new CreateMovementAction(deps),
      renameMovement: new RenameMovementAction(deps),
      deleteMovement: new DeleteMovementAction(deps),
      listMasses: new ListMassesAction(deps),
      getMass: new GetMassAction(deps),
      createMass: new CreateMassAction(deps),
      updateMass: new UpdateMassAction(deps),
      deleteMass: new DeleteMassAction(deps),
      duplicateMass: new DuplicateMassAction(deps),
      shareMass: new ShareMassAction(deps),
      leaveMass: new LeaveMassAction(deps),
      createShareLink: new CreateShareLinkAction(deps),
      revokeShareLink: new RevokeShareLinkAction(deps),
      joinMass: new JoinMassAction(deps),
      listSongs: new ListSongsAction(deps),
      getSong: new GetSongAction(deps),
      createSong: new CreateSongAction(deps),
      updateSong: new UpdateSongAction(deps),
      deleteSong: new DeleteSongAction(deps),
      uploadSongFile: new UploadSongFileAction(deps),
      removeSongFile: new RemoveSongFileAction(deps),
      listFlags: new ListFlagsAction(deps),
      createFlag: new CreateFlagAction(deps),
      updateFlag: new UpdateFlagAction(deps),
      deleteFlag: new DeleteFlagAction(deps),
      publishSite: new PublishSiteAction(deps),
    },
  };
}

export type Container = ReturnType<typeof buildContainer>;

export const UPLOADS_DIR = path.resolve("uploads");

/** Adaptadores reais: Postgres (local ou Neon), argon2, jose e Blob/disco. */
export function createAdapters(env: Env): Adapters & { pool: Pool } {
  const pool = createPool(env.DATABASE_URL);
  return {
    pool,
    users: new PgUserRepository(pool),
    sessions: new PgSessionRepository(pool),
    movements: new PgMovementRepository(pool),
    masses: new PgMassRepository(pool),
    songs: new PgSongRepository(pool),
    flags: new PgFlagRepository(pool),
    site: new DeployHookPublisher(env.SITE_DEPLOY_HOOK_URL),
    hasher: new Argon2PasswordHasher(),
    tokens: new JoseTokenService(env.JWT_SECRET, env.ACCESS_TOKEN_TTL_SECONDS),
    storage: env.BLOB_READ_WRITE_TOKEN
      ? new VercelBlobStorage(env.BLOB_READ_WRITE_TOKEN)
      : new LocalDiskStorage(UPLOADS_DIR, env.PUBLIC_URL),
    clock: { now: () => new Date() },
  };
}
