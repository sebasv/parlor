/* @refresh reload */

import { registerSW } from 'virtual:pwa-register'
import { render } from 'solid-js/web'
import App from './App.tsx'
import './styles.css'

const root = document.getElementById('root')
if (!root) throw new Error('#root not found')

render(() => <App />, root)

registerSW({ immediate: true })
