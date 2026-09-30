import argparse
import sys
import time

from sqlalchemy import func, select

from app.database import DB_PATH, Base, SessionLocal, engine
from app.models import Item, Message, User, Want


if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")


def seed(reset: bool = False) -> None:
    if reset:
        engine.dispose()
        DB_PATH.unlink(missing_ok=True)
    Base.metadata.create_all(bind=engine)

    db = SessionLocal()
    try:
        if db.scalar(select(func.count(User.id))) != 0:
            print("数据库已有住户，跳过 seed；如需重建请加 --reset。")
            return

        now = int(time.time())
        people = [
            User(name="王阿姨", room_no="3-201", avatar_emoji="👩", created_at=now),
            User(name="李叔", room_no="5-802", avatar_emoji="👨", created_at=now),
            User(name="小张", room_no="2-1101", avatar_emoji="🧑", created_at=now),
            User(name="陈老师", room_no="1-303", avatar_emoji="👩‍🏫", created_at=now),
            User(name="赵姐", room_no="4-401", avatar_emoji="🧓", created_at=now),
            User(name="刘同学", room_no="6-606", avatar_emoji="🧑‍💻", created_at=now),
        ]
        db.add_all(people)
        db.flush()
        wang, li, zhang, chen, zhao, liu = people

        item_specs = [
            (
                "婴儿推车（9 成新）", wang, "free", None, -3 * 3600, "available", None,
                "宝宝一岁半开始就不坐了，一直放在家里。折叠很方便，收起来不占地方。轮子和布套都干净，没有修过。小区里自提，我可以帮你搬到楼下。",
            ),
            (
                "电磁炉", wang, "pay_what_you_want", None, -10 * 3600, "available", None,
                "用了差不多两年，加热正常，火力档位都好用。面板有几道轻微划痕，不影响使用。搬家改用煤气了所以出手。价格好商量。",
            ),
            (
                "《活着》等 5 本小说", wang, "priced", 30, -30 * 3600, "available", None,
                "都是自己看过一遍的，书脊和页角完好，没有笔记和划线。余华的《活着》《许三观卖血记》，另外三本是推理小说。适合想随手读读的邻居。",
            ),
            (
                "绿萝两盆", liu, "free", None, -60 * 3600, "available", None,
                "养了一年多，一直放阳台，长得挺旺，叶子油绿。盆和土一起给，拿回去直接摆就行。家里绿植太多了，分两盆出来。",
            ),
            (
                "宜家书桌", wang, "priced", 150, -4 * 86400, "available", None,
                "一百二乘六十的桌面，白色，用了两年多。桌面右下角有一处磕碰痕迹，不影响使用。可拆卸，自己能装回去。需要自己搬走，我住三楼没电梯。",
            ),
            (
                "电饭煲", li, "priced", 60, -10 * 86400, "available", None,
                "三升的，两个人吃饭刚好。内胆涂层完好，没有掉漆。买了新的所以出掉。已经清洗干净，可以直接用。",
            ),
            (
                "空气炸锅", wang, "priced", 80, -6 * 86400, "given_away", 2 * 3600,
                "四升容量，做鸡翅薯条都很方便。用了半年，内胆和炸篮都洗干净了。因为换了大的，这个就没怎么用。",
            ),
            (
                "落地台灯", li, "priced", 45, -5 * 86400, "given_away", 20 * 3600,
                "暖光，三档亮度，高度可调。灯罩没有破损，底座稳。换了吸顶灯所以出掉。灯泡是好的，一起给。",
            ),
            (
                "小电扇", liu, "free", None, -8 * 86400, "available", None,
                "台式的，两档风速，夏天放桌上吹刚好。声音不大，转页正常。去年买的，用了不到十次。",
            ),
            (
                "积木玩具", chen, "free", None, -12 * 3600, "available", None,
                "孩子玩过一阵，配件都在，箱子也留着。适合三岁以上。零件已经清洗晾干，没有缺损。",
            ),
        ]
        items: list[Item] = []
        for title, owner, mode, price, age, status, completed_after, description in item_specs:
            created_at = now + age
            items.append(
                Item(
                    owner_id=owner.id,
                    title=title,
                    description=description,
                    image_url=None,
                    trade_mode=mode,
                    price=price,
                    status=status,
                    created_at=created_at,
                    given_away_at=(created_at + completed_after if completed_after is not None else None),
                )
            )
        db.add_all(items)
        db.flush()

        want_specs = [
            (items[0], [li, zhang, chen, zhao, liu]),
            (items[1], [li, zhang, chen]),
            (items[2], [liu]),
            (items[4], [zhang, zhao]),
            (items[6], [li, zhang, chen]),
            (items[7], [chen]),
            (items[8], [zhao]),
            (items[9], [zhang]),
        ]
        wants: list[Want] = []
        for item, users in want_specs:
            for user in users:
                wants.append(Want(item_id=item.id, user_id=user.id, created_at=item.created_at + 60))
        db.add_all(wants)

        message_specs = [
            (items[0], zhang, "还在吗？", now - 35 * 60),
            (items[0], li, "折叠后能放进后备箱吗？", now - 30 * 60),
            (items[1], zhao, "能便宜点吗？", now - 2 * 3600),
            (items[2], zhang, "几成新？里面有笔记吗？", now - 90 * 60),
            (items[4], chen, "能自提吗？在几号楼？", now - 4 * 3600),
            (items[6], li, "还有吗？", items[6].given_away_at - 3600),
        ]
        db.add_all(
            [
                Message(item_id=item.id, user_id=user.id, content=content, created_at=created_at)
                for item, user, content, created_at in message_specs
            ]
        )
        db.commit()
        print("Seed 完成：6 位住户、10 件物品、17 条想要、6 条留言。")
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()


def main() -> None:
    parser = argparse.ArgumentParser(description="初始化隔壁演示数据")
    parser.add_argument("--reset", action="store_true", help="删除数据库并重新生成演示数据")
    args = parser.parse_args()
    seed(reset=args.reset)


if __name__ == "__main__":
    main()
