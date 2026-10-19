import { motion } from 'framer-motion'

/** Smooth fade + slight rise on route change. Wrap a page and give it a `key`. */
export default function PageTransition({ children, style, className }) {
  return (
    <motion.div
      className={className}
      style={style}
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
    >
      {children}
    </motion.div>
  )
}
