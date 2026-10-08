    begin;

    -- Correo no almacena mensajes en Supabase. Estos permisos controlan el acceso
    -- al cliente IMAP/SMTP del Admin y se deniegan por defecto a roles no asignados.
    insert into public.admin_permissions (key, module, action, label, description, sort_order)
    values
      ('mail.view', 'mail', 'view', 'Ver correo', 'Consultar carpetas y mensajes de la cuenta corporativa.', 109),
      ('mail.send', 'mail', 'send', 'Enviar correo', 'Redactar, responder, reenviar y guardar borradores.', 110),
      ('mail.manage', 'mail', 'manage', 'Gestionar correo', 'Cambiar estados, mover y eliminar mensajes.', 111)
    on conflict (key) do update set
      module = excluded.module,
      action = excluded.action,
      label = excluded.label,
      description = excluded.description,
      sort_order = excluded.sort_order;

    -- No se añaden role_permissions: super_admin conserva su bypass explícito y
    -- cualquier otro usuario debe recibir estos permisos de forma deliberada.

    commit;
