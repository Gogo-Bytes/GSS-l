import type { Route } from './+types/home';
import Child from '../Child';
import styles from './home.gss';

export function loader({ request }: Route.LoaderArgs) {
  return { token: new URL(request.url).searchParams.get('token') ?? 'none' };
}
export default function Home({ loaderData }: Route.ComponentProps) {
  return <section data-testid="home"><Child className={styles.title} />
    <p data-testid="token">{loaderData.token}</p><div data-testid="art" className={styles.art} /></section>;
}
