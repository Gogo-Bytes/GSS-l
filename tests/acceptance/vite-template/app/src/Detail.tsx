import { useParams } from 'react-router'
import styles from './Detail.gss'

export default function Detail() {
  const { id } = useParams()
  return <section data-testid="detail" className={styles.detail}>
    <h2>Detail route {id}</h2>
    <div data-testid="detail-asset" className={styles.art} />
  </section>
}
