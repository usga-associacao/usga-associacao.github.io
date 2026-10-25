-- ============================================================
-- USGA - Ícone escolhido para cada documento de um evento
--
-- Executar ANTES de publicar o código que usa esta coluna (o admin
-- passa a gravar "icone" ao guardar os documentos).
-- Vazio = o site escolhe automaticamente pelo tipo de ficheiro.
-- ============================================================

alter table public.evento_documentos add column if not exists icone text;
