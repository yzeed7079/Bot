const { Client, GatewayIntentBits, Partials, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ChannelType, PermissionFlagsBits } = require('discord.js');

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMembers,
    ],
    partials: [Partials.Channel, Partials.Message, Partials.User, Partials.GuildMember]
});

// متغيرات عامة للبوت
const PREFIX = "!"; // بادئة الأوامر العادية لو احتجتها

client.once('ready', () => {
    console.log(`[BOT READY] تم تسجيل الدخول بنجاح باسم ${client.user.tag}! البوت شغال وجاهز.`);
    client.user.setActivity('المحافظة على أمن السيرفر | !help', { type: 3 }); // Watching status
});

// نظام الأوامر والتفاعل
client.on('messageCreate', async message => {
    if (message.author.bot) return;

    // 1. أمر البينج (اختبار سرعة البوت)
    if (message.content === '!ping' || message.content === '!بينج') {
        const ping = Math.abs(client.ws.ping);
        return message.reply(`🏓 Pong! سرعة استجابة البوت: \`${ping}ms\`.`);
    }

    // 2. أوامر الإدارة (مشابهة لجو وريزن: ميوت، باند، كيك، مسح)
    if (message.content.startsWith('!ban ') || message.content.startsWith('!بان ')) {
        if (!message.member.permissions.has(PermissionFlagsBits.BanMembers)) {
            return message.reply('❌ ما عندك صلاحية لحظر الأعضاء!');
        }
        const member = message.mentions.members.first();
        if (!member) return message.reply('⚠️️ منشن الشخص اللي تبي تحظره.');
        try {
            await member.ban();
            message.channel.sends(`✅ تم حظر العضو ${member.user.tag} بنجاح.`);
        } catch (e) {
            message.reply('❌ ما قدرت أحظر العضو، تأكد من صلاحيات البوت.');
        }
    }

    if (message.content.startsWith('!kick ') || message.content.startsWith('!طرد ')) {
        if (!message.member.permissions.has(PermissionFlagsBits.KickMembers)) {
            return message.reply('❌ ما عندك صلاحية لطرد الأعضاء!');
        }
        const member = message.mentions.members.first();
        if (!member) return message.reply('⚠️ منشن الشخص اللي تبي تطرده.');
        try {
            await member.kick();
            message.reply(`✅ تم طرد العضو ${member.user.tag} بنجاح.`);
        } catch (e) {
            message.reply('❌ ما قدرت أطرد العضو، تأكد من صلاحيات البوت.');
        }
    }

    if (message.content.startsWith('!clear ') || message.content.startsWith('!مسح ')) {
        if (!message.member.permissions.has(PermissionFlagsBits.ManageMessages)) {
            return message.reply('❌ ما عندك صلاحية لإدارة الرسائل!');
        }
        const args = message.content.split(' ');
        const count = parseInt(args[1]);
        if (!count || count < 1 || count > 100) {
            return message.reply('⚠️ حدد عدد الرسائل المراد مسحها من 1 إلى 100.');
        }
        try {
            await message.channel.bulkDelete(count, true);
            const msg = await message.channel.send(`🧹 تم مسح \`${count}\` رسالة بنجاح.`);
            setTimeout(() => msg.delete().catch(() => {}), 3000);
        } catch (e) {
            message.reply('❌ حدث خطأ، تأكد أن الرسائل أقدم من 14 يوم وأن لدي صلاحية الحذف.');
        }
    }

    // 3. أمر إرسال لوحة التكت (Ticket Panel) المستوحاة من Wix Bot
    if (message.content === '!setup-ticket' || message.content === '!تكت') {
        if (!message.member.permissions.has(PermissionFlagsBits.Administrator)) {
            return message.reply('❌ هذا الأمر خاص بالإداريين فقط!');
        }

        const embed = new EmbedBuilder()
            .setTitle('🎫 نظام تذاكر الدعم الفني')
            .setDescription('لفتح تذكرة جديدة للحصول على المساعدة أو تقديم شكوى/استفسار، اضغط على الزر أدناه 👇\n\n*يرجى عدم فتح تذكرة بدون سبب لكي لا تتعرض للعقوبة.*')
            .setColor('#5865F2')
            .setFooter({ text: 'نظام التذاكر المطور', iconURL: client.user.displayAvatarURL() });

        const row = new ActionRowBuilder().addcomponents(
            new ButtonBuilder()
                .setCustomId('open_ticket')
                .setLabel('فتح تذكرة جديدة')
                .setStyle(ButtonStyle.Primary)
                .setEmoji('🎫')
        );

        await message.channel.send({ embeds: [embed], components: [row] });
        await message.delete().catch(() => {});
    }
});

// نظام التفاعل مع أزرار التكت
client.on('interactionCreate', async interaction => {
    if (!interaction.isButton()) return;

    // عند الضغط على زر فتح التكت
    if (interaction.customId === 'open_ticket') {
        await interaction.deferReply({ ephemeral: true });

        const guild = interaction.guild;
        const member = interaction.member;

        // التحقق إذا كان المستخدم عنده تذكرة مفتوحة مسبقاً
        const existingChannel = guild.channels.cache.find(c => c.name === `ticket-${member.user.username.toLowerCase()}`);
        if (existingChannel) {
            return interaction.editReply({ content: `❌ لديك تذكرة مفتوحة بالفعل: ${existingChannel}` });
        }

        try {
            // إنشاء روم التذكرة الخاصة
            const ticketChannel = await guild.channels.create({
                name: `ticket-${member.user.username}`,
                type: ChannelType.GuildText,
                permissionOverwrites: [
                    {
                        id: guild.id, // منع الجميع من رؤية الروم
                        denied: [PermissionFlagsBits.ViewChannel],
                    },
                    {
                        id: member.id, // السماح لصاحب التذكرة بالدخول
                        allowed: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory],
                    },
                    {
                        id: client.user.id, // السماح للبوت
                        allowed: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ManageChannels],
                    }
                ],
            });

            const welcomeEmbed = new EmbedBuilder()
                .setTitle(`🎫 تذكرة العضو: ${member.user.username}`)
                .setDescription('مرحباً بك! يرجى كتابة مشكلتك أو استفسارك بالتفصيل وسيقوم فريق الإدارة بالرد عليك قريباً.')
                .setColor('#00FF00');

            const closeRow = new ActionRowBuilder().addcomponents(
                new ButtonBuilder()
                    .setCustomId('close_ticket')
                    .setLabel('إغلاق التذكرة')
                    .setStyle(ButtonStyle.Danger)
                    .setEmoji('🔒')
            );

            await ticketChannel.send({ content: `<@${member.id}> أهلاً بك`, embeds: [welcomeEmbed], components: [closeRow] });
            await interaction.editReply({ content: `✅ تم إنشاء تذكرتك بنجاح: ${ticketChannel}` });

        } catch (e) {
            console.error(e);
            await interaction.editReply({ content: '❌ حدث خطأ أثناء إنشاء التذكرة، تأكد من صلاحيات البوت.' });
        }
    }

    // عند الضغط على زر إغلاق التذكرة
    if (interaction.customId === 'close_ticket') {
        await interaction.reply('🔒 جاري إغلاق التذكرة وحذف الروم خلال 5 ثوانٍ...');
        setTimeout(() => {
            interaction.channel.delete().catch(() => {});
        }, 5000);
    }
});

// تشغيل البوت عبر التوكن المخفي في متغيرات البيئة بـ Render
client.login(process.env.TOKEN);
