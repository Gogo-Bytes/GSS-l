import type { Route } from './+types/detail';
import styles from './detail.gss';

export function loader({ request, params }: Route.LoaderArgs) {
  return { id: params.id, token: new URL(request.url).searchParams.get('token') ?? 'none' };
}
export default function Detail({ loaderData }: Route.ComponentProps) {
  return <section data-testid="detail" className={styles.detail}><h1>Detail {loaderData.id}</h1>
    <p data-testid="token">{loaderData.token}</p><div data-testid="art" className={styles.art} /></section>;
}
