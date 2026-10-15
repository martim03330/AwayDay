export type ClubRelation = 'supporter' | 'hometown';

export type MyProfile = {
  id: string;
  displayName: string;
  /** Caminho da foto no balde `avatars`; `null` quando não há foto. */
  avatarPath: string | null;
  /** Link assinado para a foto, pronto a mostrar. */
  avatarUrl: string | null;
  /** De onde é, como a pessoa o escreveu. */
  homeCity: string | null;
  supporterClubId: string | null;
  /** Only ever visible to its owner (RLS). */
  hometownClubId: string | null;
  /** Match-day suggestions and the season recap: the user decides. */
  nudgesEnabled: boolean;
  recapEnabled: boolean;
  /** Name and club in the rankings. Off unless the user turns it on. */
  showInRankings: boolean;
  /** Dizer sozinho aos grupos em que tasco se fez check-in. `null`: ainda não se perguntou (e não se partilha). */
  shareCheckinsWithGroups: boolean | null;
  /** Can confirm meeting point drafts. Only the owner sets it, never the app. */
  isAdmin: boolean;
};

export type MessagePreferences = Partial<Pick<MyProfile, 'nudgesEnabled' | 'recapEnabled'>>;

export type NotificationKind =
  | 'kickoff_change'
  | 'weather'
  | 'group_movement'
  | 'new_stamp'
  /** Mensagens na conversa do carro. */
  | 'ride_message'
  /** Mensagens na conversa de um grupo (e o «estou aqui» num tasco). */
  | 'group_message'
  /** Convites para uma boleia ou para um grupo. */
  | 'invites'
  /** Pedidos de amizade e respostas. */
  | 'friends'
  /** Despesas e pagamentos das contas da viagem. */
  | 'trip_money'
  /** Boleias oferecidas nos planos e quem entra no carro. */
  | 'rides';

/** Only the kinds the user changed; the others follow the app default. */
export type NotificationPreferences = Partial<Record<NotificationKind, boolean>>;

/** O cartão de uma pessoa: o que se mostra ao lado do nome dela numa boleia, num grupo ou numas contas. */
export type ProfileCard = {
  profileId: string;
  displayName: string;
  avatarUrl: string | null;
  homeCity: string | null;
  /** Desde quando tem conta. */
  memberSince: string;
  ridesCompleted: number;
  ridesFaults: number;
  isMe: boolean;
};

/** How someone usually gets to games. Puts first what matters to them (rides offered, or people asking). */
export type UsualTransport = 'driver' | 'passenger' | 'public_transport';

/** One of the 308 concelhos, with the centre used to sort rides by distance. Public reference data. */
export type Municipality = {
  id: string;
  name: string;
  /** The district, or «Açores» / «Madeira». */
  district: string;
  region: 'mainland' | 'madeira' | 'azores';
  latitude: number;
  longitude: number;
};

/** Where someone leaves for games from, and how they usually go. Only its owner ever reads it. */
export type MyHome = {
  municipalityId: string | null;
  usualTransport: UsualTransport | null;
};

/** Someone's public profile, opened from a chat. Only public things: never a location. */
export type PublicProfile = {
  profileId: string;
  displayName: string;
  avatarUrl: string | null;
  homeCity: string | null;
  memberSince: string;
  ridesCompleted: number;
  ridesFaults: number;
  supporterClubId: string | null;
  stadiumsStamped: number;
  isMe: boolean;
};
