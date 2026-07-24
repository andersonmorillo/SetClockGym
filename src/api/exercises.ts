import type { Exercise } from '../types'

const EXERCISES_URL =
  'https://raw.githubusercontent.com/hasaneyldrm/exercises-dataset/main/data/exercises.json'

const ASSET_BASE =
  'https://raw.githubusercontent.com/hasaneyldrm/exercises-dataset/main/'

type DatasetExercise = {
  id: string
  name: string
  category: string
  equipment: string | null
  target?: string
  secondary_muscles?: string[]
  image?: string
  gif_url?: string
  attribution?: string
}

function toAbsoluteAsset(path: string | undefined): string | null {
  if (!path) return null
  if (path.startsWith('http://') || path.startsWith('https://')) return path
  return `${ASSET_BASE}${path}`
}

function mapExercise(raw: DatasetExercise): Exercise {
  const primary = raw.target ? [raw.target] : []
  const secondary = raw.secondary_muscles ?? []

  return {
    id: raw.id,
    name: raw.name,
    equipment: raw.equipment,
    primaryMuscles: primary.length > 0 ? primary : secondary.slice(0, 1),
    category: raw.category,
    image: toAbsoluteAsset(raw.image),
    gifUrl: toAbsoluteAsset(raw.gif_url),
    attribution: raw.attribution ?? null,
  }
}

export function getExerciseImageUrl(exercise: Exercise): string | null {
  return exercise.image
}

export function getExerciseMediaUrl(
  exercise: Exercise,
  preferGif = false,
): string | null {
  if (preferGif && exercise.gifUrl) return exercise.gifUrl
  return exercise.image ?? exercise.gifUrl
}

export async function fetchExercises(): Promise<Exercise[]> {
  const response = await fetch(EXERCISES_URL)
  if (!response.ok) {
    throw new Error('Failed to load exercises')
  }
  const data = (await response.json()) as DatasetExercise[]
  return data.map(mapExercise)
}
