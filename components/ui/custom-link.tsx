import { Href, Link } from 'expo-router';
import { ComponentProps, PropsWithChildren } from 'react';

type CustomLinkProps = PropsWithChildren<{
  href: Href;
  style?: ComponentProps<typeof Link>['style'];
}>;

export function CustomLink({ children, href, style }: CustomLinkProps) {
  return (
    <Link href={href} style={style}>
          <Link.Trigger>
            {children}
          </Link.Trigger>
          <Link.Preview />
          <Link.Menu>
            <Link.MenuAction title="Action" icon="cube" onPress={() => alert('Action pressed')} />
            <Link.MenuAction
              title="Share"
              icon="square.and.arrow.up"
              onPress={() => alert('Share pressed')}
            />
            <Link.Menu title="More" icon="ellipsis">
              <Link.MenuAction
                title="Delete"
                icon="trash"
                destructive
                onPress={() => alert('Delete pressed')}
              />
            </Link.Menu>
          </Link.Menu>
        </Link>
  );
}
