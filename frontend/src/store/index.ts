import { configureStore } from '@reduxjs/toolkit'
import authReducer, { tokenRenewed } from './slices/authSlice'
import { TOKEN_RENEWED_EVENT } from '../utils/sessionToken'
import { api } from './api'
import { returnsApi } from '../services/returnsApi'

export const store = configureStore({
  reducer: {
    auth: authReducer,
    [api.reducerPath]: api.reducer,
    [returnsApi.reducerPath]: returnsApi.reducer,
  },
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware().concat(api.middleware, returnsApi.middleware),
})

// A background renewal (utils/sessionToken) keeps Redux's copy of the token in step with localStorage.
window.addEventListener(TOKEN_RENEWED_EVENT, (e) => store.dispatch(tokenRenewed((e as CustomEvent<string>).detail)))

export type RootState = ReturnType<typeof store.getState>
export type AppDispatch = typeof store.dispatch
