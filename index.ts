import type { Address, Agent, Language, HolochainLanguageDelegate, LanguageContext, Interaction} from "@perspect3vism/ad4m";
import GenericExpressionAdapter from "./adapter";
import GenericExpressionAuthorAdapter from "./authorAdapter";
import { CONFIG, DNA } from "./dna";
import { NoteExpressionUI } from './noteExpressionUI'

function interactions(expression: Address): Interaction[] {
  return [];
}

export const LANGUAGE_NAME = CONFIG.languageName;
export const name = CONFIG.dnaName;

export default async function create(context: LanguageContext): Promise<Language> {
  const Holochain = context.Holochain as HolochainLanguageDelegate;
  await Holochain.registerDNAs([{ file: DNA, nick: name }]);

  const expressionAdapter = new GenericExpressionAdapter(context);
  const authorAdaptor = new GenericExpressionAuthorAdapter(context);
  const expressionUI = new NoteExpressionUI();

  return {
    name: LANGUAGE_NAME,
    expressionAdapter,
    authorAdaptor,
    expressionUI,
    interactions,
  } as Language;
}
